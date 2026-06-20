"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: Array<{ href: string; label: string }> = [
  { href: "/dashboard/grants", label: "🔍 Grants" },
  { href: "/dashboard/pipeline", label: "🗂 Pipeline" },
  { href: "/dashboard/checklist", label: "✅ Checklist" },
  { href: "/dashboard/story-bank", label: "📚 Story Bank" },
  { href: "/dashboard/shell", label: "📝 Shell" },
  { href: "/dashboard/chat", label: "💬 Chat" },
];

export function DashboardTabs() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="mt-4 flex gap-1 rounded-xl bg-card p-1 shadow-gm-card">
      {TABS.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            data-active={active}
            aria-current={active ? "page" : undefined}
            className="flex-1 rounded-lg py-2 text-center text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
