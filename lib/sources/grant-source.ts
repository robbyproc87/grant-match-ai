import type { GrantEligibility } from "@/lib/types/eligibility";

/**
 * A funding opportunity normalized from any external grant source, shaped so
 * the ingestion layer can upsert it into `funders` + `grants` without knowing
 * which source it came from.
 *
 * Distinct from `SourceAdapter` (lib/sources/types.ts), which is funder-centric
 * (ProPublica 990 data). Opportunity-centric sources like Grants.gov return
 * *open opportunities with deadlines*, which is what discovery actually needs.
 */
export interface NormalizedOpportunity {
  /** Source slug, e.g. "grantsgov". Matches `grants.source` / `funders.source`. */
  source: string;
  /** Stable id within the source — the idempotent upsert key for the grant. */
  source_id: string;
  source_url: string;
  funder: {
    source: string;
    /** Stable funder id within the source (e.g. Grants.gov agencyCode). */
    source_id: string;
    /** Null for sources without an EIN (e.g. federal agencies). */
    ein: string | null;
    name: string;
    description: string | null;
    geographies: string[];
  };
  grant: {
    name: string;
    description: string | null;
    amount_min: number | null;
    amount_max: number | null;
    /** ISO date (YYYY-MM-DD) or null. */
    deadline: string | null;
    deadline_type: "fixed" | "rolling" | "loi_then_full";
    eligibility: GrantEligibility;
    focus_areas: string[];
    geographies: string[];
  };
}

export interface GrantSourceAdapter {
  name: string;
  /** Fetch + normalize open opportunities matching the given keyword queries. */
  fetchOpportunities(opts: {
    keywords: string[];
    limit?: number;
  }): Promise<NormalizedOpportunity[]>;
}
