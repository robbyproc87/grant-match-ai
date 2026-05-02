import { createAdminClient } from "@/lib/supabase/admin";
import { log, logError } from "@/lib/logger";
import { scoreGrantForOrg } from "./score";
import type { Funder, Grant, OrgProfile } from "@/lib/types/db";

async function loadOrg(orgId: string): Promise<OrgProfile | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("org_profiles")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!data) return null;
  return { ...(data as Record<string, unknown>), org_id: orgId } as OrgProfile;
}

async function loadGrantWithFunder(grantId: string) {
  const sb = createAdminClient();
  const { data: grant } = await sb
    .from("grants")
    .select("*")
    .eq("id", grantId)
    .maybeSingle();
  if (!grant) return null;
  const { data: funder } = await sb
    .from("funders")
    .select("*")
    .eq("id", (grant as Grant).funder_id)
    .maybeSingle();
  if (!funder) return null;
  return { grant: grant as Grant, funder: funder as Funder };
}

export async function computeOneScore(orgId: string, grantId: string): Promise<void> {
  const sb = createAdminClient();
  try {
    await sb
      .from("match_scores")
      .upsert(
        { org_id: orgId, grant_id: grantId, status: "computing", error_message: null },
        { onConflict: "org_id,grant_id" },
      );

    const org = await loadOrg(orgId);
    if (!org) throw new Error(`org not found: ${orgId}`);
    const loaded = await loadGrantWithFunder(grantId);
    if (!loaded) throw new Error(`grant or funder not found: ${grantId}`);

    const { score_total, score_breakdown } = await scoreGrantForOrg(
      org,
      loaded.grant,
      loaded.funder,
    );

    await sb.from("match_scores").upsert(
      {
        org_id: orgId,
        grant_id: grantId,
        status: "computed",
        score_total,
        score_breakdown,
        error_message: null,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "org_id,grant_id" },
    );
    log("scoring", `computed`, { orgId, grantId, score: score_total });
  } catch (err) {
    logError("scoring", `failed`, err);
    const message = err instanceof Error ? err.message : String(err);
    await sb.from("match_scores").upsert(
      {
        org_id: orgId,
        grant_id: grantId,
        status: "failed",
        error_message: message.slice(0, 500),
      },
      { onConflict: "org_id,grant_id" },
    );
  }
}

export async function computeAllScoresForOrg(orgId: string): Promise<void> {
  const sb = createAdminClient();
  const { data: grants } = await sb.from("grants").select("id");
  if (!grants) return;
  log("scoring", `starting computeAll`, { orgId, count: grants.length });
  // mark all pending
  const rows = grants.map((g) => ({
    org_id: orgId,
    grant_id: g.id as string,
    status: "pending" as const,
  }));
  await sb.from("match_scores").upsert(rows, { onConflict: "org_id,grant_id" });
  // process serially to avoid Anthropic rate limits
  for (const g of grants) {
    await computeOneScore(orgId, g.id as string);
  }
}
