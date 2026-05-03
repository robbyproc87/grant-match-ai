/**
 * Manual EIN overrides for funders where ProPublica search returns the wrong
 * top hit, returns HTTP 404 on the query, or is otherwise unreliable.
 *
 * Keys must match an entry in CURATED_FUNDER_NAMES exactly.
 * Values may include or omit the dash; the seeder strips non-digits.
 *
 * The seeder consults this map BEFORE calling propublicaAdapter.searchFoundations,
 * so an override skips search entirely and goes straight to getFoundationDetails.
 */
export const FUNDER_EIN_OVERRIDES: Record<string, string> = {
  "Conquer Cancer Foundation": "31-1667995",
  // ProPublica search for "Rally Foundation Childhood Cancer" returns 0 results
  // under any phrasing tested. Org likely indexed under a different legal name
  // (it operates as a 501(c)(3) but EIN/name pairing in IRS BMF appears off).
  // Phase 2: research alternate name or pull from a non-ProPublica source.
  // "Rally Foundation for Childhood Cancer Research": "<unknown>",

  // ProPublica search → "Nina Mason Pulliam Charitable Tr" at 35-6644088.
  // (Original override 35-6549540 returned 404 on details endpoint — wrong EIN.)
  "Nina Mason Pulliam Charitable Trust": "35-6644088",

  // ProPublica search → "Andrew Mcdonough B Positive Foundation" at 42-1741037.
  // The '+' in the seed name is rendered as 'B Positive' in IRS BMF, so neither
  // the raw '+' nor the sanitized 'B plus' query reaches the right org.
  "The Andrew McDonough B+ Foundation": "42-1741037",

  // ProPublica search returns 0 results for "Steele Foundation" + variants.
  // Not findable in IRS BMF under that name. Phase 2: investigate alternate
  // legal name (may operate under a parent foundation).
  // "The Steele Foundation (AZ)": "<unknown>",
};
