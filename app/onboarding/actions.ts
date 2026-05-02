"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/queries";
import { recomputeScoresForOrg } from "@/lib/scoring/actions";
import { log, logError } from "@/lib/logger";
import type { PastGrant } from "@/lib/types/db";

export const BasicsSchema = z.object({
  org_name: z.string().min(2, "Organization name is required."),
  ein: z
    .string()
    .regex(/^\d{2}-\d{7}$/, "EIN must be formatted as XX-XXXXXXX.")
    .or(z.literal("")),
  org_type: z.enum(["nonprofit", "school", "government", "tribal"]),
  has_501c3: z.boolean(),
  years_operating: z.coerce.number().int().min(0).max(200),
  annual_budget: z.coerce.number().nonnegative(),
  geographies: z.array(z.string().min(1)).min(1, "Add at least one geography."),
});

export const MissionSchema = z.object({
  mission: z.string().min(20, "Mission should be at least a couple of sentences."),
  focus_areas: z.array(z.string().min(1)).min(1, "Add at least one focus area."),
  populations_served: z
    .array(z.string().min(1))
    .min(1, "Add at least one population."),
});

const PastGrantSchema = z.object({
  funder_id: z.string().uuid().nullable().optional(),
  funder_name: z.string().min(2),
  amount: z.coerce.number().nonnegative().nullable(),
  year: z.coerce.number().int().min(1900).max(2100).nullable(),
});
export const HistorySchema = z.object({
  past_grants: z.array(PastGrantSchema),
});

async function ensureOrg(userId: string, orgName: string): Promise<string> {
  const sb = createAdminClient();
  const { data: existing } = await sb
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (existing?.org_id) return existing.org_id as string;

  const { data: org, error: orgErr } = await sb
    .from("orgs")
    .insert({ name: orgName })
    .select("id")
    .single();
  if (orgErr || !org) throw orgErr ?? new Error("org insert failed");
  const { error: memberErr } = await sb
    .from("org_members")
    .insert({ org_id: org.id, user_id: userId, role: "owner" });
  if (memberErr) throw memberErr;
  return org.id as string;
}

async function upsertProfile(
  orgId: string,
  patch: Record<string, unknown>,
  orgName?: string,
) {
  const sb = createAdminClient();
  const row = { org_id: orgId, org_name: orgName ?? "Untitled", ...patch };
  await sb.from("org_profiles").upsert(row, { onConflict: "org_id" });
}

async function getCallerUserId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function saveBasics(
  values: z.infer<typeof BasicsSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const userId = await getCallerUserId();
    if (!userId) return { ok: false, error: "Not signed in." };
    const data = BasicsSchema.parse(values);
    const orgId = await ensureOrg(userId, data.org_name);
    await upsertProfile(
      orgId,
      {
        ein: data.ein || null,
        org_type: data.org_type,
        has_501c3: data.has_501c3,
        years_operating: data.years_operating,
        annual_budget: data.annual_budget,
        geographies: data.geographies.map((g) => g.toUpperCase()),
      },
      data.org_name,
    );
    log("onboarding", "saved basics", { orgId });
    return { ok: true };
  } catch (err) {
    logError("onboarding", "saveBasics failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "save failed" };
  }
}

export async function saveMission(
  values: z.infer<typeof MissionSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const userId = await getCallerUserId();
    if (!userId) return { ok: false, error: "Not signed in." };
    const data = MissionSchema.parse(values);
    const sb = createAdminClient();
    const { data: member } = await sb
      .from("org_members")
      .select("org_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (!member?.org_id) return { ok: false, error: "Complete step 1 first." };
    await sb
      .from("org_profiles")
      .update({
        mission: data.mission,
        focus_areas: data.focus_areas,
        populations_served: data.populations_served,
      })
      .eq("org_id", member.org_id);
    return { ok: true };
  } catch (err) {
    logError("onboarding", "saveMission failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "save failed" };
  }
}

export async function saveHistoryAndFinish(
  values: z.infer<typeof HistorySchema>,
): Promise<{ ok: true; orgId: string } | { ok: false; error: string }> {
  try {
    const userId = await getCallerUserId();
    if (!userId) return { ok: false, error: "Not signed in." };
    const data = HistorySchema.parse(values);
    const sb = createAdminClient();
    const { data: member } = await sb
      .from("org_members")
      .select("org_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (!member?.org_id) return { ok: false, error: "Complete step 1 first." };
    const orgId = member.org_id as string;
    const past_grants: PastGrant[] = data.past_grants;
    await sb.from("org_profiles").update({ past_grants }).eq("org_id", orgId);

    // Insert pending match_score rows for every grant, then fire-and-forget compute.
    const { data: grants } = await sb.from("grants").select("id");
    if (grants && grants.length > 0) {
      const rows = grants.map((g) => ({
        org_id: orgId,
        grant_id: g.id as string,
        status: "pending" as const,
        score_total: null,
        score_breakdown: null,
        error_message: null,
      }));
      await sb.from("match_scores").upsert(rows, { onConflict: "org_id,grant_id" });
    }
    await recomputeScoresForOrg(orgId);
    revalidatePath("/dashboard/grants");
    return { ok: true, orgId };
  } catch (err) {
    logError("onboarding", "saveHistory failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "save failed" };
  }
}

export async function searchFundersForTypeahead(
  q: string,
): Promise<Array<{ id: string; name: string }>> {
  if (!q || q.length < 2) return [];
  // Defense-in-depth: only authenticated users can hit this typeahead.
  const user = await getCurrentUser();
  if (!user) return [];
  const sb = createAdminClient();
  const { data } = await sb
    .from("funders")
    .select("id, name")
    .ilike("name", `%${q}%`)
    .limit(8);
  return (data ?? []) as Array<{ id: string; name: string }>;
}
