import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentOrgProfile, getCurrentUser } from "@/lib/supabase/queries";
import { GradientHeader } from "@/components/gradient-header";

export const dynamic = "force-dynamic";

const TABS: Array<{ href: string; label: string }> = [
  { href: "/dashboard/grants", label: "🔍 Grants" },
  { href: "/dashboard/checklist", label: "✅ Checklist" },
  { href: "/dashboard/shell", label: "📝 Shell" },
  { href: "/dashboard/chat", label: "💬 Chat" },
];

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
        <nav className="mt-4 flex gap-1 rounded-xl bg-card p-1 shadow-gm-card">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="flex-1 rounded-lg py-2 text-center text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <main className="mt-4 pb-10">{children}</main>
      </div>
    </div>
  );
}
