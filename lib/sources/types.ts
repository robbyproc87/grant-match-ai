export interface FoundationSummary {
  ein: string;
  name: string;
  city?: string;
  state?: string;
}

export interface FoundationDetails {
  ein: string;
  name: string;
  description: string | null;
  total_assets: number | null;
  city: string | null;
  state: string | null;
  ntee_code: string | null;
  source_url: string;
}

export interface RecentGrant {
  funder_ein: string;
  recipient: string;
  amount: number | null;
  year: number | null;
  purpose: string | null;
}

export interface SourceAdapter {
  name: string;
  searchFoundations(query: string): Promise<FoundationSummary[]>;
  getFoundationDetails(ein: string): Promise<FoundationDetails | null>;
  getRecentGrants(ein: string): Promise<RecentGrant[]>;
}
