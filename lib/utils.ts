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

export function fitColor(score: number): string {
  if (score >= 85) return "hsl(142 71% 45%)";
  if (score >= 70) return "hsl(38 92% 50%)";
  return "hsl(0 84% 60%)";
}
