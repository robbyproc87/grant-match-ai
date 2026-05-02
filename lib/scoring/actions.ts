"use server";

import { computeAllScoresForOrg, computeOneScore } from "./runner";
import { log, logError } from "@/lib/logger";

/**
 * Fire-and-forget recompute for an entire org.
 * Returns immediately; scoring runs on the server in the background.
 */
export async function recomputeScoresForOrg(orgId: string): Promise<void> {
  if (!orgId) return;
  // Intentionally no await — kick off and return.
  void computeAllScoresForOrg(orgId).catch((err) =>
    logError("scoring", "background computeAll failed", err),
  );
  log("scoring", "kicked off background compute", { orgId });
}

export async function recomputeOneScore(orgId: string, grantId: string): Promise<void> {
  if (!orgId || !grantId) return;
  void computeOneScore(orgId, grantId).catch((err) =>
    logError("scoring", "background computeOne failed", err),
  );
}
