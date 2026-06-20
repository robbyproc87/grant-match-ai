export type OrgType = "nonprofit" | "school" | "government" | "tribal";
export type DeadlineType = "fixed" | "rolling" | "loi_then_full";
export type ScoreStatus = "pending" | "computing" | "computed" | "failed";
export type StoryKind =
  | "impact_stat"
  | "testimonial"
  | "program"
  | "narrative"
  | "other";

export interface StoryBlock {
  id: string;
  org_id: string;
  kind: StoryKind;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

/** The five narrative sections the shell drafts. */
export interface DraftSections {
  need_statement?: string;
  goals?: string;
  approach?: string;
  budget_narrative?: string;
  sustainability?: string;
}

export interface DraftReview {
  summary: string;
  suggestions: Array<{ section: string; issue: string; fix: string }>;
}

export interface ApplicationDraft {
  application_id: string;
  org_id: string;
  sections: DraftSections;
  review: DraftReview | null;
  updated_at: string;
}

export const DRAFT_SECTION_KEYS: Array<keyof DraftSections> = [
  "need_statement",
  "goals",
  "approach",
  "budget_narrative",
  "sustainability",
];
export type ApplicationStatus =
  | "identified"
  | "drafting"
  | "submitted"
  | "won"
  | "lost"
  | "declined";

export interface Application {
  id: string;
  org_id: string;
  grant_id: string;
  status: ApplicationStatus;
  notes: string | null;
  deadline: string | null;
  owner_user_id: string | null;
  checklist: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

export interface OrgProfile {
  org_id: string;
  ein: string | null;
  org_name: string;
  org_type: OrgType;
  has_501c3: boolean;
  years_operating: number;
  annual_budget: number;
  mission: string;
  focus_areas: string[];
  populations_served: string[];
  geographies: string[];
  past_grants: PastGrant[];
  updated_at: string;
}

export interface PastGrant {
  funder_id?: string | null;
  funder_name: string;
  amount: number | null;
  year: number | null;
}

export interface Funder {
  id: string;
  ein: string;
  name: string;
  description: string | null;
  focus_areas: string[];
  geographies: string[];
  total_assets: number | null;
  source: string;
  source_url: string | null;
}

export interface Grant {
  id: string;
  funder_id: string;
  name: string;
  description: string | null;
  amount_min: number | null;
  amount_max: number | null;
  deadline: string | null;
  deadline_type: DeadlineType;
  eligibility: unknown;
  focus_areas: string[];
  geographies: string[];
  source: string;
  source_url: string | null;
}

export interface MatchScore {
  org_id: string;
  grant_id: string;
  status: ScoreStatus;
  score_total: number | null;
  score_breakdown: ScoreBreakdown | null;
  error_message: string | null;
  computed_at: string | null;
}

export interface ScoreBreakdown {
  mission_alignment: { score: number; reasoning: string };
  geographic_fit: { score: number; reasoning: string };
  budget_fit: { score: number; reasoning: string };
  eligibility: {
    score: number;
    reasoning: string;
    failed_rules: string[];
    manual_checks: string[];
  };
  population_alignment: { score: number; reasoning: string };
  prior_relationship: { score: number; reasoning: string };
}
