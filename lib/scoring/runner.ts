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
    .maybeSingle<OrgProfile>();
  if (!data) return null;
  return { ...data, org_id: orgId };
}

async function loadGrantWithFunder(
  grantId: string,
): Promise<{ grant: Grant; funder: Funder } | null> {
  const sb = createAdminClient();
  const { data: grant } = await sb
    .from("grants")
    .select("*")
    .eq("id", grantId)
    .maybeSingle<Grant>();
  if (!grant) return null;
  const { data: funder } = await sb
    .from("funders")
    .select("*")
    .eq("id", grant.funder_id)
    .maybeSingle<Funder>();
  if (!funder) return null;
  return { grant, funder };
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

/**
 * Drain the durable scoring queue. Atomically claims a batch of queued rows
 * via `claim_scoring_jobs` (FOR UPDATE SKIP LOCKED — safe to run concurrently)
 * and scores each with bounded concurrency (batch size = concurrency cap).
 * Loops until the queue is empty or `maxBatches` is hit.
 *
 * Invoked two ways: (1) by pg_cron via /api/internal/drain-scoring every minute
 * — the durable backstop that survives instance restarts; (2) best-effort by
 * producers right after they enqueue, for immediate responsiveness. Either way
 * unfinished rows stay 'pending' (or stale 'computing', reclaimed after the
 * TTL), so no work is dropped on a crash.
 */
export async function drainScoringJobs(opts?: {
  batch?: number;
  maxBatches?: number;
}): Promise<{ processed: number; batches: number }> {
  const sb = createAdminClient();
  const batch = opts?.batch ?? 5;
  const maxBatches = opts?.maxBatches ?? 50;
  let processed = 0;
  let batches = 0;
  for (; batches < maxBatches; batches++) {
    const { data, error } = await sb.rpc("claim_scoring_jobs", { batch });
    if (error) {
      logError("scoring", "claim_scoring_jobs failed", error);
      break;
    }
    const rows = (data ?? []) as Array<{
      claimed_org_id: string;
      claimed_grant_id: string;
    }>;
    if (rows.length === 0) break;
    await Promise.all(
      rows.map((r) => computeOneScore(r.claimed_org_id, r.claimed_grant_id)),
    );
    processed += rows.length;
  }
  if (processed > 0) log("scoring", "drain complete", { processed, batches });
  return { processed, batches };
}

/** Fire the drain best-effort (don't block the producer; cron is the backstop). */
function kickDrain(): void {
  void drainScoringJobs().catch((err) =>
    logError("scoring", "best-effort drain failed", err),
  );
}

/**
 * Stale-while-revalidate: if the org_profile.updated_at is newer than a row's
 * computed_at, mark that row pending so the drainer recomputes it. Cheap to
 * call on every dashboard load — touches only stale rows.
 */
export async function requeueStaleScoresForOrg(orgId: string): Promise<void> {
  const sb = createAdminClient();
  const { data: prof } = await sb
    .from("org_profiles")
    .select("updated_at")
    .eq("org_id", orgId)
    .maybeSingle();
  const updatedAt = (prof as { updated_at?: string } | null)?.updated_at;
  if (!updatedAt) return;

  const { data: stale } = await sb
    .from("match_scores")
    .select("grant_id, computed_at, status")
    .eq("org_id", orgId)
    .or(`computed_at.is.null,computed_at.lt.${updatedAt}`);
  const rows = (stale ?? []) as Array<{
    grant_id: string;
    computed_at: string | null;
    status: string;
  }>;
  const toRecompute = rows.filter(
    (r) => r.status === "computed" && r.computed_at && r.computed_at < updatedAt,
  );
  if (toRecompute.length === 0) return;
  log("scoring", "requeueing stale scores", {
    orgId,
    count: toRecompute.length,
  });
  await sb.from("match_scores").upsert(
    toRecompute.map((r) => ({
      org_id: orgId,
      grant_id: r.grant_id,
      status: "pending" as const,
    })),
    { onConflict: "org_id,grant_id" },
  );
  kickDrain();
}

/**
 * Phase 1 defensive escape hatch: flip every match_scores row for this org
 * that is in a non-terminal-success state ('pending' | 'computing' | 'failed')
 * back to 'pending' with error_message cleared, then recompute each.
 *
 * Rows already in 'computed' are left alone (use `requeueStaleScoresForOrg`
 * for the stale-while-revalidate path). This exists so a Replit instance
 * restart that strands rows in 'computing' can be recovered by a single
 * user click — Phase 2 will replace it with a proper job-queue sweeper.
 */
export async function recomputeAllNonComputedForOrg(orgId: string): Promise<void> {
  const sb = createAdminClient();
  const { data: rows } = await sb
    .from("match_scores")
    .select("grant_id, status")
    .eq("org_id", orgId)
    .in("status", ["pending", "computing", "failed"]);
  const toRun = (rows ?? []) as Array<{ grant_id: string; status: string }>;
  if (toRun.length === 0) {
    log("scoring", "recomputeAllNonComputed: nothing to do", { orgId });
    return;
  }
  log("scoring", "recomputeAllNonComputed: requeueing", {
    orgId,
    count: toRun.length,
  });
  await sb.from("match_scores").upsert(
    toRun.map((r) => ({
      org_id: orgId,
      grant_id: r.grant_id,
      status: "pending" as const,
      error_message: null,
    })),
    { onConflict: "org_id,grant_id" },
  );
  kickDrain();
}

export async function computeAllScoresForOrg(orgId: string): Promise<void> {
  const sb = createAdminClient();
  const { data: grants } = await sb.from("grants").select("id");
  if (!grants) return;
  log("scoring", `enqueued all`, { orgId, count: grants.length });
  // Enqueue every grant as 'pending'; the drainer (kicked below + pg_cron)
  // processes them with bounded concurrency. No inline serial loop — that was
  // the Phase 1 fragility (lost on instance restart).
  const rows = grants.map((g) => ({
    org_id: orgId,
    grant_id: g.id as string,
    status: "pending" as const,
  }));
  await sb.from("match_scores").upsert(rows, { onConflict: "org_id,grant_id" });
  kickDrain();
}
