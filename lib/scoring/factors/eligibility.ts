import { GrantEligibilitySchema } from "@/lib/types/eligibility";

export type EligibilityResult = {
  score: 0 | 15;
  reasoning: string;
  failed_rules: string[];
  manual_checks: string[];
};

export type OrgForEligibility = {
  has_501c3: boolean;
  years_operating: number;
  annual_budget: number;
  org_type: "nonprofit" | "school" | "government" | "tribal";
  geographies: string[];
};

export function scoreEligibility(
  rawEligibility: unknown,
  org: OrgForEligibility,
): EligibilityResult {
  const parsed = GrantEligibilitySchema.safeParse(rawEligibility);
  if (!parsed.success) {
    return {
      score: 0,
      reasoning: "malformed eligibility data",
      failed_rules: ["malformed_schema"],
      manual_checks: [],
    };
  }
  const e = parsed.data;
  const failed: string[] = [];

  if (e.requires_501c3 && !org.has_501c3) failed.push("requires 501(c)(3) status");

  if (typeof e.min_org_years === "number" && org.years_operating < e.min_org_years) {
    failed.push(`requires at least ${e.min_org_years} years of operation`);
  }
  if (typeof e.min_org_budget === "number" && org.annual_budget < e.min_org_budget) {
    failed.push(`org budget below minimum ($${e.min_org_budget.toLocaleString()})`);
  }
  if (typeof e.max_org_budget === "number" && org.annual_budget > e.max_org_budget) {
    failed.push(`org budget exceeds maximum ($${e.max_org_budget.toLocaleString()})`);
  }
  if (e.allowed_org_types && e.allowed_org_types.length > 0) {
    if (!e.allowed_org_types.includes(org.org_type)) {
      failed.push(
        `org type "${org.org_type}" not in allowed [${e.allowed_org_types.join(", ")}]`,
      );
    }
  }
  if (e.allowed_geographies && e.allowed_geographies.length > 0) {
    const allowed = e.allowed_geographies.map((g) => g.toUpperCase());
    const orgGeos = org.geographies.map((g) => g.toUpperCase());
    const passes =
      allowed.includes("NATIONAL") || orgGeos.some((g) => allowed.includes(g));
    if (!passes) {
      failed.push(`org geographies do not intersect allowed [${allowed.join(", ")}]`);
    }
  }
  if (e.excluded_geographies && e.excluded_geographies.length > 0) {
    const excluded = e.excluded_geographies.map((g) => g.toUpperCase());
    const orgGeos = org.geographies.map((g) => g.toUpperCase());
    if (orgGeos.some((g) => excluded.includes(g))) {
      failed.push(`org geographies overlap excluded [${excluded.join(", ")}]`);
    }
  }

  const manual_checks = e.custom_rules ?? [];
  if (failed.length === 0) {
    return {
      score: 15,
      reasoning: "Org satisfies all evaluated hard eligibility rules.",
      failed_rules: [],
      manual_checks,
    };
  }
  return {
    score: 0,
    reasoning: `Failed ${failed.length} eligibility rule${failed.length === 1 ? "" : "s"}.`,
    failed_rules: failed,
    manual_checks,
  };
}
