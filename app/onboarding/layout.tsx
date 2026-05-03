import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentOrgId } from "@/lib/supabase/queries";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function isOnboardingComplete(orgId: string): Promise<boolean> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("org_profiles")
    .select("mission")
    .eq("org_id", orgId)
    .maybeSingle();
  const mission = (data as { mission?: string | null } | null)?.mission;
  return typeof mission === "string" && mission.trim().length > 0;
}

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  // Step 1 creates the org membership but the user still needs to fill in
  // mission (step 2) and history (step 3). Only redirect away from onboarding
  // once the profile is actually populated, otherwise step 2 / step 3 would
  // be unreachable after step 1 saves.
  const orgId = await getCurrentOrgId(user.id);
  if (orgId && (await isOnboardingComplete(orgId))) {
    redirect("/dashboard/grants");
  }
  return (
    <div className="min-h-screen bg-gm-gradient py-10">
      <div className="mx-auto max-w-xl px-4">
        <div className="mb-6 text-center text-white">
          <div className="text-2xl">🌈</div>
          <div className="text-xs uppercase tracking-wide opacity-80">
            GrantMatch AI
          </div>
          <h1 className="mt-2 text-xl font-bold">Set up your workspace</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
