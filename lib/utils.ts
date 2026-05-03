import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${n}`;
}

export function formatDeadline(d: string | null | undefined): string {
  if (!d) return "Rolling";
  try {
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

// Returns a `hsl(var(--fit-*))` reference; the actual color tiers live in
// `app/globals.css` so they stay tokenized with the rest of the design system.
export function fitColor(score: number): string {
  if (score >= 85) return "hsl(var(--fit-strong))";
  if (score >= 70) return "hsl(var(--fit-medium))";
  return "hsl(var(--fit-weak))";
}
