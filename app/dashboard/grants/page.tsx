import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgProfile, getCurrentUser } from "@/lib/supabase/queries";
import { GrantsClient } from "./grants-client";
import {
  computeAllScoresForOrg,
  requeueStaleScoresForOrg,
} from "@/lib/scoring/runner";
import { log, logError } from "@/lib/logger";
import type { Grant, MatchScore } from "@/lib/types/db";

export const dynamic = "force-dynamic";

export default async function GrantsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const profile = await getCurrentOrgProfile(user.id);
  if (!profile) redirect("/onboarding/basics");

  // Stale-while-revalidate: any score older than the org_profile.updated_at
  // is recomputed in the background. Cheap on every load (no-op when fresh).
  void requeueStaleScoresForOrg(profile.org_id).catch((err) =>
    logError("scoring", "requeueStale failed", err),
  );

  const supabase = createClient();
  const [grantsRes, scoresRes, fundersRes] = await Promise.all([
    supabase.from("grants").select("*"),
    supabase.from("match_scores").select("*").eq("org_id", profile.org_id),
    supabase.from("funders").select("id, name"),
  ]);
  const grants = (grantsRes.data ?? []) as Grant[];
  let scores = (scoresRes.data ?? []) as MatchScore[];
  const funders = (fundersRes.data ?? []) as Array<{ id: string; name: string }>;

  // Safety fallback: if the org somehow has zero match_scores rows but grants
  // exist (e.g. saveHistoryAndFinish raced or was interrupted), kick off a
  // full compute now so polling activates and the user isn't stuck on a blank
  // dashboard. Render the page immediately with status='pending' rows so the
  // grants list shows skeletons.
  if (grants.length > 0 && scores.length === 0) {
    log("scoring", "grants page: no scores yet, initializing", {
      orgId: profile.org_id,
      grants: grants.length,
    });
    scores = grants.map((g) => ({
      org_id: profile.org_id,
      grant_id: g.id,
      status: "pending",
      score_total: null,
      score_breakdown: null,
      error_message: null,
      computed_at: null,
    })) as MatchScore[];
    void computeAllScoresForOrg(profile.org_id).catch((err) =>
      logError("scoring", "fallback computeAll failed", err),
    );
  }

  const funderMap = new Map<string, string>(funders.map((f) => [f.id, f.name]));

  return (
    <GrantsClient
      orgId={profile.org_id}
      grants={grants}
      initialScores={scores}
      funderNames={Object.fromEntries(funderMap)}
    />
  );
}
