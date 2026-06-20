import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgProfile, getCurrentUser } from "@/lib/supabase/queries";
import { PipelineClient } from "./pipeline-client";
import type { Application, Grant } from "@/lib/types/db";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const profile = await getCurrentOrgProfile(user.id);
  if (!profile) redirect("/onboarding/basics");

  const supabase = createClient();

  // Load applications for this org
  const { data: appsData } = await supabase
    .from("applications")
    .select("*")
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: false });

  const applications = (appsData ?? []) as Application[];

  // Load the referenced grants
  const grantIds = [...new Set(applications.map((a) => a.grant_id))];
  let grants: Grant[] = [];
  let funderNames: Record<string, string> = {};

  if (grantIds.length > 0) {
    const { data: grantsData } = await supabase
      .from("grants")
      .select("*")
      .in("id", grantIds);
    grants = (grantsData ?? []) as Grant[];

    const funderIds = [...new Set(grants.map((g) => g.funder_id))];
    if (funderIds.length > 0) {
      const { data: fundersData } = await supabase
        .from("funders")
        .select("id, name")
        .in("id", funderIds);
      const funders = (fundersData ?? []) as Array<{ id: string; name: string }>;
      funderNames = Object.fromEntries(funders.map((f) => [f.id, f.name]));
    }
  }

  const grantMap = new Map<string, Grant>(grants.map((g) => [g.id, g]));

  return (
    <PipelineClient
      applications={applications}
      grantMap={Object.fromEntries(grantMap)}
      funderNames={funderNames}
    />
  );
}
