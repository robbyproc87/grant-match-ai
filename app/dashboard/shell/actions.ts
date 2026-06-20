"use server";

import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { revalidatePath } from "next/cache";
import { CHAT_MODEL } from "@/lib/anthropic/models";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getCurrentOrgId } from "@/lib/supabase/queries";
import { log, logError } from "@/lib/logger";
import type { DraftSections, DraftReview, StoryBlock } from "@/lib/types/db";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const SECTION_LABELS: Record<keyof DraftSections, string> = {
  need_statement: "Statement of Need",
  goals: "Goals & Measurable Objectives",
  approach: "Approach / Program Design",
  budget_narrative: "Budget Narrative",
  sustainability: "Sustainability",
};

/** Pull the first JSON object out of a model response, tolerating fences/prose. */
function extractJson(text: string): unknown {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fence ? fence[1] : text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in response");
  return JSON.parse(raw.slice(start, end + 1));
}

async function loadContext(applicationId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in.");
  const orgId = await getCurrentOrgId(user.id);
  if (!orgId) throw new Error("No org.");
  const sb = createClient();

  const { data: app } = (await sb
    .from("applications")
    .select("id, grant_id, org_id")
    .eq("id", applicationId)
    .eq("org_id", orgId)
    .maybeSingle()) as { data: { id: string; grant_id: string; org_id: string } | null };
  if (!app) throw new Error("Application not found.");

  const { data: grant } = (await sb
    .from("grants")
    .select(
      "name, description, amount_min, amount_max, deadline, focus_areas, geographies, eligibility, funder_id",
    )
    .eq("id", app.grant_id)
    .maybeSingle()) as { data: Record<string, unknown> | null };
  if (!grant) throw new Error("Grant not found.");

  const [{ data: funder }, { data: profile }, { data: stories }] = (await Promise.all([
    sb.from("funders").select("name, description").eq("id", grant.funder_id as string).maybeSingle(),
    sb.from("org_profiles").select("*").eq("org_id", orgId).maybeSingle(),
    sb.from("story_blocks").select("kind, title, content, tags").eq("org_id", orgId).limit(25),
  ])) as [
    { data: { name: string; description: string | null } | null },
    { data: Record<string, unknown> | null },
    { data: Array<Pick<StoryBlock, "kind" | "title" | "content" | "tags">> | null },
  ];

  return { sb, orgId, app, grant, funder, profile, stories: stories ?? [] };
}

function storyBankText(
  stories: Array<Pick<StoryBlock, "kind" | "title" | "content" | "tags">>,
): string {
  if (stories.length === 0) return "(No story bank entries yet — rely on the org profile.)";
  return stories
    .map((s) => `- [${s.kind}] ${s.title}: ${s.content}`)
    .join("\n")
    .slice(0, 6000);
}

export async function generateDraft(
  applicationId: string,
): Promise<Result<DraftSections>> {
  try {
    const { sb, orgId, grant, funder, profile, stories } = await loadContext(applicationId);
    const p = (profile ?? {}) as Record<string, unknown>;

    const system = `You are a senior grant writer drafting a proposal for a nonprofit.
Write in the org's authentic voice — concrete, evidence-led, never generic boilerplate.
Ground every section in the org's mission, the funder's priorities, and the story bank below.
Return ONLY a JSON object (no prose, no code fences) with these string keys:
"need_statement", "goals", "approach", "budget_narrative", "sustainability".
Each value is 1–3 tight paragraphs of ready-to-edit prose.`;

    const prompt = `ORG
- Name: ${p.org_name ?? "(unknown)"}
- Mission: ${p.mission ?? "(none)"}
- Focus areas: ${(p.focus_areas as string[] | undefined)?.join(", ") || "(none)"}
- Populations served: ${(p.populations_served as string[] | undefined)?.join(", ") || "(none)"}
- Annual budget: $${Number(p.annual_budget ?? 0).toLocaleString()}
- Years operating: ${p.years_operating ?? "?"}
- Geographies: ${(p.geographies as string[] | undefined)?.join(", ") || "(none)"}

FUNDER & GRANT
- Funder: ${funder?.name ?? "(unknown)"}${funder?.description ? ` — ${funder.description}` : ""}
- Grant: ${grant.name}
- Description: ${(grant.description as string) ?? "(none)"}
- Award range: $${Number(grant.amount_min ?? 0).toLocaleString()}–$${Number(grant.amount_max ?? 0).toLocaleString()}
- Funder focus areas: ${(grant.focus_areas as string[] | undefined)?.join(", ") || "(none)"}

STORY BANK (reuse and tailor these — do not invent facts beyond them)
${storyBankText(stories)}

Draft the five sections now. JSON only.`;

    const { text } = await generateText({
      model: anthropic(CHAT_MODEL),
      system,
      prompt,
      maxTokens: 2200,
    });
    const parsed = extractJson(text) as Record<string, unknown>;
    const sections: DraftSections = {};
    for (const key of Object.keys(SECTION_LABELS) as Array<keyof DraftSections>) {
      const v = parsed[key];
      if (typeof v === "string") sections[key] = v;
    }
    if (Object.keys(sections).length === 0) throw new Error("Model returned no sections.");

    await sb
      .from("application_drafts")
      .upsert(
        { application_id: applicationId, org_id: orgId, sections } as never,
        { onConflict: "application_id" },
      );
    log("chat", "draft generated", { applicationId, sections: Object.keys(sections).length });
    revalidatePath("/dashboard/shell");
    return { ok: true, data: sections };
  } catch (err) {
    logError("chat", "generateDraft failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "draft failed" };
  }
}

export async function reviewDraft(applicationId: string): Promise<Result<DraftReview>> {
  try {
    const { sb, grant, funder } = await loadContext(applicationId);
    const { data: draft } = (await sb
      .from("application_drafts")
      .select("sections")
      .eq("application_id", applicationId)
      .maybeSingle()) as { data: { sections: DraftSections } | null };
    if (!draft?.sections || Object.keys(draft.sections).length === 0) {
      return { ok: false, error: "Generate a draft first." };
    }

    const system = `You are a program officer at the funder, reviewing this draft the way you'd
score a real submission. Be specific and constructive. Return ONLY a JSON object:
{"summary": "<2-3 sentence verdict>", "suggestions": [{"section": "<section key>", "issue": "<what's weak>", "fix": "<concrete revision>"}]}
Section keys are: need_statement, goals, approach, budget_narrative, sustainability.`;

    const draftText = (Object.keys(SECTION_LABELS) as Array<keyof DraftSections>)
      .map((k) => `## ${SECTION_LABELS[k]}\n${draft.sections[k] ?? "(empty)"}`)
      .join("\n\n");

    const prompt = `FUNDER: ${funder?.name ?? "(unknown)"}
GRANT: ${grant.name}
FUNDER ELIGIBILITY/PRIORITIES: ${JSON.stringify(grant.eligibility)}
GRANT DESCRIPTION: ${(grant.description as string) ?? "(none)"}

DRAFT UNDER REVIEW:
${draftText}

Review it as the funder. JSON only.`;

    const { text } = await generateText({
      model: anthropic(CHAT_MODEL),
      system,
      prompt,
      maxTokens: 1200,
    });
    const parsed = extractJson(text) as Partial<DraftReview>;
    const review: DraftReview = {
      summary: typeof parsed.summary === "string" ? parsed.summary : "No summary.",
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions
            .filter(
              (s): s is DraftReview["suggestions"][number] =>
                !!s && typeof s.section === "string" && typeof s.issue === "string" && typeof s.fix === "string",
            )
            .slice(0, 12)
        : [],
    };
    await sb
      .from("application_drafts")
      .update({ review } as never)
      .eq("application_id", applicationId);
    revalidatePath("/dashboard/shell");
    return { ok: true, data: review };
  } catch (err) {
    logError("chat", "reviewDraft failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "review failed" };
  }
}

/** Persist human edits to the draft sections. */
export async function saveDraftSections(
  applicationId: string,
  sections: DraftSections,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not signed in." };
    const orgId = await getCurrentOrgId(user.id);
    if (!orgId) return { ok: false, error: "No org." };
    const sb = createClient();
    const { error } = await sb
      .from("application_drafts")
      .upsert(
        { application_id: applicationId, org_id: orgId, sections } as never,
        { onConflict: "application_id" },
      );
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    logError("chat", "saveDraftSections failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "save failed" };
  }
}
