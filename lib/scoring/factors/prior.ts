import type { PastGrant } from "@/lib/types/db";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(foundation|fund|inc|the)\b/g, "")
    .trim();
}

export function scorePriorRelationship(
  funderId: string,
  funderName: string,
  pastGrants: PastGrant[],
): { score: number; reasoning: string } {
  if (!pastGrants || pastGrants.length === 0) {
    return { score: 0, reasoning: "No prior grant history with this funder." };
  }
  const direct = pastGrants.find((g) => g.funder_id && g.funder_id === funderId);
  if (direct) {
    return {
      score: 10,
      reasoning: `Prior relationship with funder${direct.year ? ` (${direct.year})` : ""}.`,
    };
  }
  const target = normalize(funderName);
  const fuzzy = pastGrants.find((g) => {
    const candidate = normalize(g.funder_name);
    return (
      candidate.length > 2 &&
      target.length > 2 &&
      (candidate.includes(target) || target.includes(candidate))
    );
  });
  if (fuzzy) {
    return {
      score: 7,
      reasoning: `Likely prior relationship (name match: "${fuzzy.funder_name}").`,
    };
  }
  return { score: 0, reasoning: "No prior grant history with this funder." };
}
