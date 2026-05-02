import type { Grant, Funder, OrgProfile, ScoreBreakdown } from "@/lib/types/db";
import { scoreEligibility } from "./factors/eligibility";
import { scoreGeographic } from "./factors/geographic";
import { scoreBudget } from "./factors/budget";
import { scorePriorRelationship } from "./factors/prior";
import {
  scoreMissionAndPopulation,
  type MissionPopulationResult,
} from "./factors/mission-population";

export type ComposeInput = {
  org: OrgProfile;
  grant: Grant;
  funder: Funder;
  missionPop?: MissionPopulationResult;
};

export type ComposeResult = {
  score_total: number;
  score_breakdown: ScoreBreakdown;
};

export function composeScore(input: ComposeInput): ComposeResult {
  const { org, grant, funder, missionPop } = input;

  const eligibility = scoreEligibility(grant.eligibility, {
    has_501c3: org.has_501c3,
    years_operating: org.years_operating,
    annual_budget: org.annual_budget,
    org_type: org.org_type,
    geographies: org.geographies,
  });
  const geographic_fit = scoreGeographic(grant.geographies, org.geographies);
  const budget_fit = scoreBudget(grant.amount_min, grant.amount_max, org.annual_budget);
  const prior_relationship = scorePriorRelationship(
    funder.id,
    funder.name,
    org.past_grants,
  );

  const mission_alignment = missionPop?.mission ?? {
    score: 0,
    reasoning: "Not yet evaluated.",
  };
  const population_alignment = missionPop?.population ?? {
    score: 0,
    reasoning: "Not yet evaluated.",
  };

  const breakdown: ScoreBreakdown = {
    mission_alignment,
    geographic_fit,
    budget_fit,
    eligibility: {
      score: eligibility.score,
      reasoning: eligibility.reasoning,
      failed_rules: eligibility.failed_rules,
      manual_checks: eligibility.manual_checks,
    },
    population_alignment,
    prior_relationship,
  };
  const total =
    mission_alignment.score +
    geographic_fit.score +
    budget_fit.score +
    eligibility.score +
    population_alignment.score +
    prior_relationship.score;

  return { score_total: total, score_breakdown: breakdown };
}

export async function scoreGrantForOrg(
  org: OrgProfile,
  grant: Grant,
  funder: Funder,
): Promise<ComposeResult> {
  const missionPop = await scoreMissionAndPopulation({
    orgName: org.org_name,
    orgMission: org.mission,
    orgFocusAreas: org.focus_areas ?? [],
    orgPopulationsServed: org.populations_served ?? [],
    grantName: grant.name,
    grantDescription: grant.description,
    grantFocusAreas: grant.focus_areas ?? [],
    funderName: funder.name,
  });
  return composeScore({ org, grant, funder, missionPop });
}
