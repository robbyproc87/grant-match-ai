/**
 * Curated funder name list — pediatric / children's-health / Arizona-leaning.
 *
 * The seed-funders runner resolves each name to an EIN via
 * propublicaAdapter.searchFoundations(name) and takes the top-scoring hit.
 * Names should be precise enough to disambiguate (prefer
 * "Virginia G. Piper Charitable Trust" over "Piper Trust").
 */
export const CURATED_FUNDER_NAMES: string[] = [
  "Arizona Community Foundation",
  "Vitalyst Health Foundation",
  "Virginia G. Piper Charitable Trust",
  "Helios Education Foundation",
  "Alex's Lemonade Stand Foundation",
  "St. Baldrick's Foundation",
  "Children's Health Fund",
  "Pediatric Cancer Research Foundation",
  "CureSearch for Children's Cancer",
  "Ronald McDonald House Charities",
  "Make-A-Wish Foundation of America",
  "National Pediatric Cancer Foundation",
  "The Andrew McDonough B+ Foundation",
  "Hyundai Hope On Wheels",
  "Conquer Cancer Foundation",
  // "Rally Foundation for Childhood Cancer Research", // Not in ProPublica — defer to Phase 2 with richer source (Candid/GuideStar)
  "Cookies for Kids' Cancer",
  "American Childhood Cancer Organization",
  "Phoenix Children's Hospital Foundation",
  "Banner Health Foundation",
  "Flinn Foundation (AZ)",
  "Nina Mason Pulliam Charitable Trust",
  // "The Steele Foundation (AZ)", // Not in ProPublica — defer to Phase 2 with richer source (Candid/GuideStar)
  "BHHS Legacy Foundation",
  "Thunderbirds Charities",
];
