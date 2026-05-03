export function scoreBudget(
  amountMin: number | null,
  amountMax: number | null,
  orgAnnualBudget: number,
): { score: number; reasoning: string } {
  if (orgAnnualBudget <= 0) {
    return { score: 5, reasoning: "Org budget unknown — partial credit." };
  }
  const max = amountMax ?? amountMin ?? 0;
  if (max === 0) {
    return { score: 8, reasoning: "Award size unknown — partial credit." };
  }
  // Strong fit: award is between 1% and 50% of org annual budget.
  const ratio = max / orgAnnualBudget;
  if (ratio >= 0.01 && ratio <= 0.5) {
    return {
      score: 15,
      reasoning: `Award size ($${max.toLocaleString()}) is well-scaled to org budget ($${orgAnnualBudget.toLocaleString()}).`,
    };
  }
  if (ratio > 0.5 && ratio <= 1.0) {
    return {
      score: 10,
      reasoning: `Award is large relative to org budget (${(ratio * 100).toFixed(0)}%).`,
    };
  }
  if (ratio < 0.01) {
    return {
      score: 8,
      reasoning: `Award is small relative to org budget (${(ratio * 100).toFixed(2)}%).`,
    };
  }
  return {
    score: 3,
    reasoning: `Award would exceed org annual budget (${(ratio * 100).toFixed(0)}%) — likely capacity mismatch.`,
  };
}
