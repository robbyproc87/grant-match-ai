import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgProfile, getCurrentUser } from "@/lib/supabase/queries";
import { ShellClient } from "./shell-client";
import type { Application, ApplicationDraft, Grant } from "@/lib/types/db";

export const dynamic = "force-dynamic";

export default async function ShellPage() {
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

  // Load referenced grants
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

  // Load existing drafts for this org's applications
  const appIds = applications.map((a) => a.id);
  let drafts: ApplicationDraft[] = [];
  if (appIds.length > 0) {
    const { data: draftsData } = await supabase
      .from("application_drafts")
      .select("*")
      .in("application_id", appIds);
    drafts = (draftsData ?? []) as ApplicationDraft[];
  }

  const grantMap = Object.fromEntries(grants.map((g) => [g.id, g]));
  const draftMap = Object.fromEntries(drafts.map((d) => [d.application_id, d]));

  return (
    <ShellClient
      applications={applications}
      grantMap={grantMap}
      funderNames={funderNames}
      draftMap={draftMap}
    />
  );
}
