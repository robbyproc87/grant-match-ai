"use server";

import {
  computeAllScoresForOrg,
  computeOneScore,
  recomputeAllNonComputedForOrg,
} from "./runner";
import { getCurrentUser, getCurrentOrgId } from "@/lib/supabase/queries";
import { log, logError } from "@/lib/logger";

/**
 * Authorize that the calling user is a member of `orgId`.
 * Returns the verified org_id (server-derived) — callers MUST use this, not
 * the user-supplied id.
 */
async function requireOrgMembership(orgId: string): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in.");
  const callerOrg = await getCurrentOrgId(user.id);
  if (!callerOrg || callerOrg !== orgId) {
    throw new Error("Forbidden: not a member of this org.");
  }
  return callerOrg;
}

/**
 * Fire-and-forget recompute for an entire org.
 * Returns immediately; scoring runs on the server in the background.
 *
 * Phase 2 TODO: replace fire-and-forget with a durable queue (DB job table +
 * worker / Edge Function) so an instance shutdown can't drop work.
 */
export async function recomputeScoresForOrg(orgId: string): Promise<void> {
  const verified = await requireOrgMembership(orgId);
  void computeAllScoresForOrg(verified).catch((err) =>
    logError("scoring", "background computeAll failed", err),
  );
  log("scoring", "kicked off background compute", { orgId: verified });
}

/**
 * Phase 1 escape hatch: requeue every match_scores row for this org that is
 * NOT in 'computed' status. Useful when a Replit restart leaves rows stuck
 * in 'computing'. Authz-checked; fire-and-forget.
 */
export async function recomputeAllForOrg(orgId: string): Promise<void> {
  const verified = await requireOrgMembership(orgId);
  void recomputeAllNonComputedForOrg(verified).catch((err) =>
    logError("scoring", "background recomputeAll failed", err),
  );
  log("scoring", "kicked off recomputeAll", { orgId: verified });
}

export async function recomputeOneScore(
  orgId: string,
  grantId: string,
): Promise<void> {
  if (!grantId) return;
  const verified = await requireOrgMembership(orgId);
  void computeOneScore(verified, grantId).catch((err) =>
    logError("scoring", "background computeOne failed", err),
  );
}
