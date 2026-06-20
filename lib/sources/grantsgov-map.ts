/**
 * Grants.gov public REST API — raw TypeScript types + a PURE mapping function.
 * No network I/O, no side-effects.
 *
 * Real API field notes (verified against live endpoints 2026-06-19):
 *   - awardFloor / awardCeiling / estimatedFunding are STRINGS ("2000000"), not numbers.
 *   - responseDate is a human-readable timestamp: "Jul 08, 2026 12:00:00 AM EDT"
 *     (the search hit uses MM/DD/YYYY for openDate/closeDate, the detail synopsis
 *      uses the long format for responseDate).
 *   - applicantTypes is array of {id, description} objects.
 *   - fundingActivityCategories is array of {id, description} objects,
 *     but may degrade to strings in some responses — handle both.
 */

import type { NormalizedOpportunity } from "./grant-source";

// ---------------------------------------------------------------------------
// Raw API types
// ---------------------------------------------------------------------------

/** A lightweight hit from POST /v1/api/search2 */
export interface GrantsGovSearchHit {
  /** Numeric id as a string ("362288") */
  id: string;
  number: string;
  title: string;
  agencyCode: string;
  agency: string;
  /** MM/DD/YYYY */
  openDate: string;
  /** MM/DD/YYYY */
  closeDate: string;
  oppStatus: string;
  docType: string;
  cfdaList?: string[];
}

/** A category / applicant-type entry — may appear as object or bare string */
export type GrantsGovDescribedEntry =
  | { id: string; description: string }
  | string;

/** The synopsis block inside POST /v1/api/fetchOpportunity → data */
export interface GrantsGovSynopsis {
  agencyCode?: string;
  agencyName?: string;
  synopsisDesc?: string;
  /** Long human-readable timestamp: "Jul 08, 2026 12:00:00 AM EDT" */
  responseDate?: string;
  postingDate?: string;
  archiveDate?: string;
  /** String amount, may be "0" or absent */
  awardCeiling?: string;
  /** String amount, may be "0" or absent */
  awardFloor?: string;
  /** String amount */
  estimatedFunding?: string;
  applicantEligibilityDesc?: string;
  applicantTypes?: GrantsGovDescribedEntry[];
  fundingInstruments?: GrantsGovDescribedEntry[];
  fundingActivityCategories?: GrantsGovDescribedEntry[];
}

/** The opportunity detail returned by POST /v1/api/fetchOpportunity → data */
export interface GrantsGovOpportunityDetail {
  id?: number;
  opportunityNumber?: string;
  opportunityTitle?: string;
  owningAgencyCode?: string;
  synopsis?: GrantsGovSynopsis;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Strip HTML tags and decode common entities to plain text. */
function stripHtml(raw: string): string {
  return raw
    // Remove all HTML tags
    .replace(/<[^>]*>/g, " ")
    // Decode common HTML entities
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&sect;/gi, "§")
    .replace(/&#\d+;/g, " ")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    // Remove space before punctuation that was introduced by tag removal
    .replace(/ ([.,;:!?)\]])/g, "$1")
    .trim();
}

/**
 * Parse a date to YYYY-MM-DD or return null on failure.
 *
 * Handles two formats seen in the live API:
 *   - Synopsis responseDate: "Jul 08, 2026 12:00:00 AM EDT"  (long human format)
 *   - Search hit openDate/closeDate: "06/05/2026"            (MM/DD/YYYY)
 *
 * Never throws.
 */
function parseDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();

  // MM/DD/YYYY
  const mdyMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (mdyMatch) {
    const [, mm, dd, yyyy] = mdyMatch;
    return `${yyyy}-${mm}-${dd}`;
  }

  // "Mon DD, YYYY ..." — e.g. "Jul 08, 2026 12:00:00 AM EDT"
  const longMatch = s.match(
    /^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/,
  );
  if (longMatch) {
    const [, mon, day, year] = longMatch;
    const months: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04",
      may: "05", jun: "06", jul: "07", aug: "08",
      sep: "09", oct: "10", nov: "11", dec: "12",
    };
    const monthNum = months[mon.toLowerCase().slice(0, 3)];
    if (!monthNum) return null;
    return `${year}-${monthNum}-${day.padStart(2, "0")}`;
  }

  return null;
}

/**
 * Parse a string amount to a positive number or null.
 * Returns null for absent, "0", or non-numeric values.
 */
function parseAmount(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (isNaN(n) || n <= 0) return null;
  return n;
}

/**
 * Extract description strings from a fundingActivityCategories array.
 * Handles both `{id, description}` objects and bare strings.
 */
function extractDescriptions(
  entries: GrantsGovDescribedEntry[] | undefined,
): string[] {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  return entries
    .map((e) => (typeof e === "string" ? e : e.description ?? ""))
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Public mapper
// ---------------------------------------------------------------------------

/**
 * Map a Grants.gov fetchOpportunity detail object to a NormalizedOpportunity.
 *
 * Pure function — no network, no I/O, no throwing on missing fields.
 */
export function mapOpportunity(
  detail: GrantsGovOpportunityDetail,
): NormalizedOpportunity {
  const syn = detail.synopsis ?? {};

  // Opportunity id — prefer the numeric id, fall back to opportunityNumber
  const opportunityId = detail.id != null ? String(detail.id) : "";

  // Funder
  const agencyCode =
    detail.owningAgencyCode ?? syn.agencyCode ?? "";
  const agencyName = syn.agencyName ?? agencyCode;

  // Grant amounts
  const amountFloor = parseAmount(syn.awardFloor);
  const amountCeiling = parseAmount(syn.awardCeiling);
  const amountEstimated = parseAmount(syn.estimatedFunding);

  const amount_min = amountFloor;
  // If ceiling is absent but estimated is present, use estimated as max
  const amount_max = amountCeiling ?? (amountFloor == null ? amountEstimated : null);

  // Deadline
  const deadline = parseDate(syn.responseDate);

  // Description — strip HTML from synopsisDesc
  const rawDesc = syn.synopsisDesc ?? null;
  const description = rawDesc ? stripHtml(rawDesc) : null;

  // Focus areas from fundingActivityCategories
  const focus_areas = extractDescriptions(syn.fundingActivityCategories);

  // Eligibility — per spec: never auto-evaluate applicantTypes to our 4 org types;
  // surface applicantEligibilityDesc as a single custom_rules entry for manual review.
  const rawEligDesc = syn.applicantEligibilityDesc
    ? stripHtml(syn.applicantEligibilityDesc).trim()
    : null;
  const custom_rules = rawEligDesc ? [rawEligDesc] : undefined;

  return {
    source: "grantsgov",
    source_id: opportunityId,
    source_url: `https://www.grants.gov/search-results-detail/${opportunityId}`,
    funder: {
      source: "grantsgov",
      source_id: agencyCode,
      ein: null,
      name: agencyName,
      description: null,
      geographies: ["NATIONAL"],
    },
    grant: {
      name: detail.opportunityTitle ?? "",
      description,
      amount_min,
      amount_max,
      deadline,
      deadline_type: "fixed",
      eligibility: {
        requires_501c3: false,
        allowed_geographies: ["national"],
        ...(custom_rules ? { custom_rules } : {}),
      },
      focus_areas,
      geographies: ["NATIONAL"],
    },
  };
}
