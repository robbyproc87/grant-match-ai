import { redirect } from "next/navigation";
import { getCurrentOrgProfile, getCurrentUser } from "@/lib/supabase/queries";
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
