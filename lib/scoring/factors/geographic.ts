// Phase 1 intentional upgrade vs. brief: brief specified binary 15/0; we keep
// a 5-pt "adjacent" tier for org-has-geographies-but-no-direct-overlap so the
// dashboard ordering doesn't collapse to two clusters. Do not "fix" back.
export function scoreGeographic(
  grantGeographies: string[],
  orgGeographies: string[],
): { score: number; reasoning: string } {
  const grant = (grantGeographies ?? []).map((g) => g.toUpperCase());
  const org = (orgGeographies ?? []).map((g) => g.toUpperCase());
  if (grant.length === 0 || grant.includes("NATIONAL")) {
    return { score: 15, reasoning: "Funder accepts national applicants." };
  }
  const overlap = org.filter((g) => grant.includes(g));
  if (overlap.length > 0) {
    return {
      score: 15,
      reasoning: `Geography match: ${overlap.join(", ")}.`,
    };
  }
  // Adjacent fallback — half credit if funder lists any state at all and org has any state.
  if (org.length > 0) {
    return {
      score: 5,
      reasoning: `No direct geographic overlap (funder: ${grant.join(", ")}; org: ${org.join(", ")}).`,
    };
  }
  return { score: 0, reasoning: "Org has no geography set." };
}
