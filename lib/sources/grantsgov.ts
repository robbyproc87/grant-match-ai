import type { GrantSourceAdapter, NormalizedOpportunity } from "./grant-source";
import {
  mapOpportunity,
  type GrantsGovSearchHit,
  type GrantsGovOpportunityDetail,
} from "./grantsgov-map";
import { log, logError } from "@/lib/logger";

const BASE = "https://api.grants.gov/v1/api";

interface Search2Response {
  data?: { hitCount?: number; oppHits?: GrantsGovSearchHit[] };
}
interface FetchOpportunityResponse {
  data?: GrantsGovOpportunityDetail;
}

async function postJson<T>(path: string, body: unknown, attempt = 0): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "GrantMatchAI/0.2",
    },
    body: JSON.stringify(body),
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    const delay = 1000 * Math.pow(2, attempt);
    log("grantsgov", `${res.status}; backing off ${delay}ms`, { path });
    await new Promise((r) => setTimeout(r, delay));
    return postJson<T>(path, body, attempt + 1);
  }
  if (!res.ok) throw new Error(`Grants.gov ${res.status} for ${path}`);
  return (await res.json()) as T;
}

/**
 * Grants.gov adapter — free public REST API (no key). Opportunity-centric:
 * search2 returns lightweight hits; fetchOpportunity returns the full synopsis
 * we actually map (award amounts, deadline, eligibility text).
 */
export const grantsgovAdapter: GrantSourceAdapter = {
  name: "grantsgov",

  async fetchOpportunities({ keywords, limit = 25 }): Promise<NormalizedOpportunity[]> {
    const idToOpp = new Map<string, NormalizedOpportunity>();

    for (const keyword of keywords) {
      let ids: string[] = [];
      try {
        const search = await postJson<Search2Response>("search2", {
          keyword,
          rows: limit,
          oppStatuses: "posted",
        });
        ids = (search.data?.oppHits ?? []).map((h) => String(h.id));
        log("grantsgov", `search "${keyword}"`, {
          hitCount: search.data?.hitCount,
          fetched: ids.length,
        });
      } catch (err) {
        logError("grantsgov", `search failed for "${keyword}"`, err);
        continue;
      }

      for (const id of ids) {
        if (idToOpp.has(id)) continue; // dedupe across keyword queries
        try {
          const detail = await postJson<FetchOpportunityResponse>(
            "fetchOpportunity",
            { opportunityId: Number(id) },
          );
          if (!detail.data) continue;
          idToOpp.set(id, mapOpportunity(detail.data));
        } catch (err) {
          logError("grantsgov", `fetchOpportunity failed for ${id}`, err);
        }
        // Be a polite client to a free public API.
        await new Promise((r) => setTimeout(r, 150));
      }
    }

    return [...idToOpp.values()];
  },
};
