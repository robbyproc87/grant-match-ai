import { streamText, type CoreMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { CHAT_MODEL } from "@/lib/anthropic/models";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgProfile, getCurrentUser } from "@/lib/supabase/queries";
import { logError, log } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return new Response("Unauthorized", { status: 401 });
    const profile = await getCurrentOrgProfile(user.id);
    if (!profile)
      return new Response("Complete onboarding first", { status: 400 });

    const body = (await req.json()) as {
      messages: CoreMessage[];
      orgId?: string;
      grantId?: string;
    };
    const messages = body.messages ?? [];
    if (body.orgId && body.orgId !== profile.org_id) {
      return new Response("Org mismatch", { status: 403 });
    }

    // Optional grant context: when the user is asking about a specific grant,
    // ground the assistant in that grant + funder + this org's score breakdown.
    const grantContext = body.grantId
      ? await loadGrantContext(profile.org_id, body.grantId)
      : null;
    const system = buildSystemPrompt(profile, grantContext);
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const userText =
      lastUser && typeof lastUser.content === "string" ? lastUser.content : "";

    const onFinish = makeOnFinish(profile.org_id, user.id, userText);

    const tryStream = () =>
      streamText({
        model: anthropic(CHAT_MODEL),
        system,
        messages,
        maxTokens: 1500,
        onFinish,
      });

    let result;
    try {
      result = await tryStream();
    } catch (firstErr) {
      logError("chat", "stream attempt 1 failed, retrying once", firstErr);
      try {
        result = await tryStream();
      } catch (secondErr) {
        logError("chat", "stream attempt 2 failed, degrading", secondErr);
        return new Response(
          JSON.stringify({
            error:
              "The assistant is having trouble responding right now. Please try again in a moment.",
            degraded: true,
          }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    log("chat", "stream started", { orgId: profile.org_id });
    return result.toDataStreamResponse();
  } catch (err) {
    logError("chat", "route exception", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "chat failed",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

function makeOnFinish(orgId: string, userId: string, userText: string) {
  return async ({ text }: { text: string }) => {
    try {
      const sb = createClient();
      type MessageInsert = {
        org_id: string;
        user_id: string;
        role: "user" | "assistant";
        content: string;
      };
      const rows: MessageInsert[] = [];
      if (userText.trim()) {
        rows.push({
          org_id: orgId,
          user_id: userId,
          role: "user",
          content: userText,
        });
      }
      if (text.trim()) {
        rows.push({
          org_id: orgId,
          user_id: userId,
          role: "assistant",
          content: text,
        });
      }
      if (rows.length > 0) {
        // The Database type still uses permissive `Record<string, unknown>` for
        // Insert (replaced in Phase 2 follow-up #3 by `supabase gen types`),
        // so the typed client can't infer the row shape here. Cast through
        // unknown to MessageInsert which IS strictly typed at construction.
        await sb.from("messages").insert(rows as unknown as never);
      }
    } catch (err) {
      logError("chat", "persist messages failed", err);
    }
  };
}

/**
 * Build a grant-context block from the grant + its funder + this org's score
 * breakdown. Uses the user-scoped client so RLS enforces org access to the
 * score (grants/funders are globally readable to authenticated users). Returns
 * null if the grant isn't found.
 */
async function loadGrantContext(
  orgId: string,
  grantId: string,
): Promise<string | null> {
  try {
    const sb = createClient();
    const { data: grant } = (await sb
      .from("grants")
      .select(
        "name, description, amount_min, amount_max, deadline, deadline_type, focus_areas, geographies, funder_id, source_url",
      )
      .eq("id", grantId)
      .maybeSingle()) as { data: GrantContextRow | null };
    if (!grant) return null;

    const [{ data: funder }, { data: score }] = (await Promise.all([
      sb.from("funders").select("name, description").eq("id", grant.funder_id).maybeSingle(),
      sb
        .from("match_scores")
        .select("score_total, score_breakdown")
        .eq("org_id", orgId)
        .eq("grant_id", grantId)
        .maybeSingle(),
    ])) as [
      { data: { name: string; description: string | null } | null },
      {
        data: {
          score_total: number | null;
          score_breakdown: Record<string, { score: number; reasoning: string }> | null;
        } | null;
      },
    ];

    const fmt = (n: number | null) =>
      n == null ? "?" : `$${Number(n).toLocaleString()}`;
    const lines = [
      `\nCURRENT GRANT IN FOCUS — ground all advice in this opportunity:`,
      `- Grant: ${grant.name}`,
      `- Funder: ${funder?.name ?? "(unknown)"}`,
      `- Award range: ${fmt(grant.amount_min)}–${fmt(grant.amount_max)}`,
      `- Deadline: ${grant.deadline ?? grant.deadline_type}`,
      `- Focus areas: ${(grant.focus_areas ?? []).join(", ") || "(none listed)"}`,
      `- Geographies: ${(grant.geographies ?? []).join(", ") || "(none listed)"}`,
      grant.description ? `- Description: ${grant.description.slice(0, 700)}` : null,
    ];
    if (score?.score_total != null) {
      lines.push(`- This org's fit score: ${score.score_total}/100.`);
      const b = score.score_breakdown;
      if (b) {
        const factor = (k: string, label: string) =>
          b[k] ? `    · ${label}: ${b[k].score} — ${b[k].reasoning}` : null;
        const breakdown = [
          factor("mission_alignment", "Mission"),
          factor("geographic_fit", "Geography"),
          factor("budget_fit", "Budget"),
          factor("eligibility", "Eligibility"),
          factor("population_alignment", "Population"),
          factor("prior_relationship", "Prior relationship"),
        ].filter(Boolean);
        if (breakdown.length) lines.push("  Score breakdown:", ...(breakdown as string[]));
      }
    }
    return lines.filter(Boolean).join("\n");
  } catch (err) {
    logError("chat", "loadGrantContext failed", err);
    return null;
  }
}

type GrantContextRow = {
  name: string;
  description: string | null;
  amount_min: number | null;
  amount_max: number | null;
  deadline: string | null;
  deadline_type: string;
  focus_areas: string[];
  geographies: string[];
  funder_id: string;
  source_url: string | null;
};

function buildSystemPrompt(
  profile: {
    org_name: string;
    mission: string;
    focus_areas: string[];
    annual_budget: number;
    populations_served: string[];
  },
  grantContext: string | null,
): string {
  return `You are a senior grant writing strategist embedded inside GrantMatch AI.
You help one specific nonprofit win grants — be concrete, specific, and actionable.

ABOUT THE ORG
- Name: ${profile.org_name}
- Mission: ${profile.mission || "(not provided)"}
- Focus areas: ${(profile.focus_areas ?? []).join(", ") || "(not provided)"}
- Populations served: ${(profile.populations_served ?? []).join(", ") || "(not provided)"}
- Annual budget: $${(profile.annual_budget ?? 0).toLocaleString()}
${grantContext ?? ""}

GUIDELINES
- Be direct. Skip preambles like "Great question!"
- When giving narrative examples, write in a tone the org could ship.
- Always tie advice back to this org's mission and capacity — never give generic boilerplate.
${grantContext ? "- A specific grant is in focus (above). Tailor everything to it; reference its funder, deadline, and the fit-score reasoning when relevant." : "- If asked about a specific grant, ask for the funder name if not provided."}
- Cite reasoning briefly. Use lists when there are 3+ steps.`;
}
