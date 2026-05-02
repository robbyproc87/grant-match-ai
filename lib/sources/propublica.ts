import type {
  SourceAdapter,
  FoundationSummary,
  FoundationDetails,
  RecentGrant,
} from "./types";
import { log, logError } from "@/lib/logger";

const BASE = "https://projects.propublica.org/nonprofits/api/v2";
const cache = new Map<string, unknown>();

async function fetchWithBackoff(url: string, attempt = 0): Promise<Response> {
  const res = await fetch(url, { headers: { "User-Agent": "GrantMatchAI/0.1" } });
  if (res.status === 429 && attempt < 3) {
    const delay = 1000 * Math.pow(2, attempt);
    log("propublica", `429 rate-limited; backing off ${delay}ms`);
    await new Promise((r) => setTimeout(r, delay));
    return fetchWithBackoff(url, attempt + 1);
  }
  return res;
}

async function getJson<T>(url: string): Promise<T> {
  if (cache.has(url)) return cache.get(url) as T;
  const res = await fetchWithBackoff(url);
  if (!res.ok) {
    throw new Error(`ProPublica ${res.status} for ${url}`);
  }
  const json = (await res.json()) as T;
  cache.set(url, json);
  return json;
}

interface SearchResponse {
  organizations: Array<{
    ein: number;
    name: string;
    city: string;
    state: string;
  }>;
}

interface OrgResponse {
  organization: {
    ein: number;
    name: string;
    address: string;
    city: string;
    state: string;
    ntee_code: string | null;
  };
  filings_with_data?: Array<{
    tax_prd_yr: number;
    totassetsend: number | null;
  }>;
}

export const propublicaAdapter: SourceAdapter = {
  name: "propublica",

  async searchFoundations(query: string): Promise<FoundationSummary[]> {
    try {
      const url = `${BASE}/search.json?q=${encodeURIComponent(query)}&ntee%5Bid%5D=7`;
      const data = await getJson<SearchResponse>(url);
      return (data.organizations ?? []).map((o) => ({
        ein: String(o.ein).padStart(9, "0"),
        name: o.name,
        city: o.city,
        state: o.state,
      }));
    } catch (err) {
      logError("propublica", `search failed for "${query}"`, err);
      return [];
    }
  },

  async getFoundationDetails(ein: string): Promise<FoundationDetails | null> {
    const cleaned = ein.replace(/\D/g, "");
    try {
      const url = `${BASE}/organizations/${cleaned}.json`;
      const data = await getJson<OrgResponse>(url);
      const o = data.organization;
      const latest = data.filings_with_data?.[0];
      return {
        ein: String(o.ein).padStart(9, "0"),
        name: o.name,
        description: null,
        total_assets: latest?.totassetsend ?? null,
        city: o.city ?? null,
        state: o.state ?? null,
        ntee_code: o.ntee_code,
        source_url: `https://projects.propublica.org/nonprofits/organizations/${cleaned}`,
      };
    } catch (err) {
      logError("propublica", `details failed for ${ein}`, err);
      return null;
    }
  },

  async getRecentGrants(_ein: string): Promise<RecentGrant[]> {
    // ProPublica's free API does not expose grant disbursement data per foundation.
    // Returning empty for Phase 1; future adapters (Candid, etc.) will populate.
    return [];
  },
};
