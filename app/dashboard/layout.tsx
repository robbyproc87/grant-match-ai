import { redirect } from "next/navigation";
import {
  getCurrentOrgProfile,
  getCurrentUser,
  isOnboardingComplete,
} from "@/lib/supabase/queries";
import { GradientHeader } from "@/components/gradient-header";
import { DashboardTabs } from "./dashboard-tabs";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const profile = await getCurrentOrgProfile(user.id);
  if (!profile) redirect("/onboarding/basics");
  // Profile may exist after step 1 even when onboarding isn't complete; bounce
  // partials back into the wizard so they can finish mission + history.
  if (!(await isOnboardingComplete(profile.org_id))) {
    redirect("/onboarding/basics");
  }

  return (
    <div className="min-h-screen">
      <GradientHeader
        title={profile.org_name}
        subtitle="AI-matched funding opportunities and a writing assistant — all in one place."
        email={user.email ?? ""}
      />
      <div className="mx-auto max-w-3xl px-4">
        <DashboardTabs />
        <main className="mt-4 pb-10">{children}</main>
      </div>
    </div>
  );
}
