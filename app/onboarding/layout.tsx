import { redirect } from "next/navigation";
import {
  getCurrentUser,
  getCurrentOrgId,
  isOnboardingComplete,
} from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  // Only fully-onboarded users (step 3 complete → onboarding_completed_at set)
  // are redirected out. Partially-onboarded users stay in the wizard so they
  // can finish steps 2 and 3.
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
