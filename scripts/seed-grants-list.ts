import type { GrantEligibility } from "@/lib/types/eligibility";

export interface SeedGrant {
  /** Must match a name in scripts/seed-funders-list.ts (CURATED_FUNDER_NAMES). */
  funder_name: string;
  name: string;
  description: string;
  amount_min: number;
  amount_max: number;
  deadline: string | null;
  deadline_type: "fixed" | "rolling" | "loi_then_full";
  eligibility: GrantEligibility;
  focus_areas: string[];
  geographies: string[];
  source_url: string;
}

export const CURATED_GRANTS: SeedGrant[] = [
  {
    funder_name: 'Arizona Community Foundation',
    name: "Responsive Grants Program",
    description:
      "Flexible operating and program support for Arizona nonprofits serving community-defined needs.",
    amount_min: 5000,
    amount_max: 25000,
    deadline: null,
    deadline_type: "rolling",
    eligibility: {
      requires_501c3: true,
      max_org_budget: 5_000_000,
      allowed_org_types: ["nonprofit"],
      allowed_geographies: ["AZ"],
      custom_rules: ["Must demonstrate community board representation"],
    },
    focus_areas: ["Community Health", "Children", "Equity"],
    geographies: ["AZ"],
    source_url: "https://azfoundation.org",
  },
  {
    funder_name: 'Vitalyst Health Foundation',
    name: "Community Health Grant",
    description:
      "Supports Arizona-based health equity initiatives, with emphasis on underserved children and families.",
    amount_min: 10000,
    amount_max: 50000,
    deadline: "2026-06-01",
    deadline_type: "loi_then_full",
    eligibility: {
      requires_501c3: true,
      min_org_years: 2,
      allowed_geographies: ["AZ"],
      custom_rules: ["LOI required before full proposal"],
    },
    focus_areas: ["Health Equity", "Pediatric", "Arizona"],
    geographies: ["AZ"],
    source_url: "https://vitalysthealth.org",
  },
  {
    funder_name: 'Alex\'s Lemonade Stand Foundation',
    name: "Childhood Cancer Innovation Grant",
    description:
      "Supports innovative programs serving pediatric cancer patients and their families nationally.",
    amount_min: 5000,
    amount_max: 50000,
    deadline: "2026-07-31",
    deadline_type: "fixed",
    eligibility: {
      requires_501c3: true,
      allowed_geographies: ["NATIONAL"],
    },
    focus_areas: ["Pediatric Cancer", "Comfort Care", "Family Support"],
    geographies: ["NATIONAL"],
    source_url: "https://alexslemonade.org",
  },
  {
    funder_name: 'St. Baldrick\'s Foundation',
    name: "St. Baldrick's Hero Fund",
    description:
      "Funds named for and supporting children with cancer through targeted research and family support programs.",
    amount_min: 10000,
    amount_max: 75000,
    deadline: "2026-09-15",
    deadline_type: "fixed",
    eligibility: {
      requires_501c3: true,
      min_org_years: 3,
      allowed_geographies: ["NATIONAL"],
    },
    focus_areas: ["Pediatric Cancer", "Research", "Family Support"],
    geographies: ["NATIONAL"],
    source_url: "https://stbaldricks.org",
  },
  {
    funder_name: 'Children\'s Health Fund',
    name: "Pediatric Program Grants",
    description:
      "Hospital-partnered grants supporting access to pediatric care for under-resourced communities.",
    amount_min: 15000,
    amount_max: 75000,
    deadline: "2026-08-15",
    deadline_type: "fixed",
    eligibility: {
      requires_501c3: true,
      min_org_years: 5,
      allowed_geographies: ["NATIONAL"],
      custom_rules: ["Letters of support from at least one hospital partner required"],
    },
    focus_areas: ["Pediatric Health", "Hospital-based"],
    geographies: ["NATIONAL"],
    source_url: "https://childrenshealthfund.org",
  },
  {
    funder_name: 'Phoenix Children\'s Hospital Foundation',
    name: "Family Support Mini-Grant",
    description:
      "Small-dollar grants supporting comfort, dignity, and family support programs at Phoenix Children's Hospital.",
    amount_min: 1000,
    amount_max: 10000,
    deadline: null,
    deadline_type: "rolling",
    eligibility: {
      requires_501c3: true,
      allowed_geographies: ["AZ"],
    },
    focus_areas: ["Pediatric", "Family Support", "Comfort Care"],
    geographies: ["AZ"],
    source_url: "https://www.phoenixchildrensfoundation.org",
  },
  {
    funder_name: 'Make-A-Wish Foundation of America',
    name: "Wish Granter Community Partner Grant",
    description:
      "Supports community organizations that partner with Make-A-Wish to enhance the wish experience.",
    amount_min: 5000,
    amount_max: 25000,
    deadline: "2026-05-30",
    deadline_type: "fixed",
    eligibility: {
      requires_501c3: true,
      allowed_geographies: ["NATIONAL"],
    },
    focus_areas: ["Pediatric", "Family Support"],
    geographies: ["NATIONAL"],
    source_url: "https://wish.org",
  },
  {
    funder_name: 'Pediatric AIDS Foundation',
    name: "Pediatric AIDS Innovation Fund",
    description:
      "Funds grassroots organizations supporting children and families affected by HIV/AIDS.",
    amount_min: 5000,
    amount_max: 30000,
    deadline: "2026-10-01",
    deadline_type: "fixed",
    eligibility: {
      requires_501c3: true,
      allowed_geographies: ["NATIONAL"],
    },
    focus_areas: ["Pediatric Health", "Family Support"],
    geographies: ["NATIONAL"],
    source_url: "https://www.pedaids.org",
  },
  {
    funder_name: 'Starlight Children\'s Foundation',
    name: "Starlight Hospital Happiness Grant",
    description:
      "Supports programs delivering comfort, distraction, and joy to hospitalized children.",
    amount_min: 2500,
    amount_max: 15000,
    deadline: null,
    deadline_type: "rolling",
    eligibility: {
      requires_501c3: true,
      allowed_geographies: ["NATIONAL"],
    },
    focus_areas: ["Pediatric", "Comfort Care", "Hospital-based"],
    geographies: ["NATIONAL"],
    source_url: "https://www.starlight.org",
  },
  {
    funder_name: 'Children\'s Miracle Network Hospitals',
    name: "Hospital-Based Children's Program Grant",
    description:
      "Supports hospital-based programs that serve pediatric patients and families.",
    amount_min: 10000,
    amount_max: 100000,
    deadline: "2026-11-15",
    deadline_type: "fixed",
    eligibility: {
      requires_501c3: true,
      min_org_years: 3,
      allowed_geographies: ["NATIONAL"],
    },
    focus_areas: ["Pediatric Health", "Hospital-based", "Family Support"],
    geographies: ["NATIONAL"],
    source_url: "https://childrensmiraclenetworkhospitals.org",
  },
  {
    funder_name: 'Virginia G. Piper Charitable Trust',
    name: "Piper Trust Children & Family Grant",
    description:
      "Supports programs benefiting children and families across Maricopa County, Arizona.",
    amount_min: 25000,
    amount_max: 250000,
    deadline: "2026-09-01",
    deadline_type: "loi_then_full",
    eligibility: {
      requires_501c3: true,
      min_org_years: 3,
      allowed_geographies: ["AZ"],
      custom_rules: ["Must serve Maricopa County residents primarily"],
    },
    focus_areas: ["Children", "Family Support", "Arizona"],
    geographies: ["AZ"],
    source_url: "https://pipertrust.org",
  },
  {
    funder_name: 'Pediatric Cancer Research Foundation',
    name: "Pediatric Cancer Research Family Grant",
    description:
      "Supports family-facing programs adjacent to pediatric oncology research efforts.",
    amount_min: 5000,
    amount_max: 25000,
    deadline: "2026-08-01",
    deadline_type: "fixed",
    eligibility: {
      requires_501c3: true,
      allowed_geographies: ["NATIONAL"],
    },
    focus_areas: ["Pediatric Cancer", "Family Support"],
    geographies: ["NATIONAL"],
    source_url: "https://pcrf-kids.org",
  },
];
