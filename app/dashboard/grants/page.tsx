import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgProfile, getCurrentUser } from "@/lib/supabase/queries";
import { GrantsClient } from "./grants-client";
import type { Grant, MatchScore } from "@/lib/types/db";

export const dynamic = "force-dynamic";

export default async function GrantsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const profile = await getCurrentOrgProfile(user.id);
  if (!profile) redirect("/onboarding/basics");

  const supabase = createClient();
  const [grantsRes, scoresRes, fundersRes] = await Promise.all([
    supabase.from("grants").select("*"),
    supabase.from("match_scores").select("*").eq("org_id", profile.org_id),
    supabase.from("funders").select("id, name"),
  ]);
  const grants = (grantsRes.data ?? []) as Grant[];
  const scores = (scoresRes.data ?? []) as MatchScore[];
  const funders = (fundersRes.data ?? []) as Array<{ id: string; name: string }>;

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
