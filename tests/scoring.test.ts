import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { scoreEligibility } from "@/lib/scoring/factors/eligibility";
import { scoreGeographic } from "@/lib/scoring/factors/geographic";
import { scoreBudget } from "@/lib/scoring/factors/budget";
import { scorePriorRelationship } from "@/lib/scoring/factors/prior";
import { composeScore } from "@/lib/scoring/score";
import type { Grant, Funder, OrgProfile } from "@/lib/types/db";

const baseOrg = {
  has_501c3: true,
  years_operating: 14,
  annual_budget: 250_000,
  org_type: "nonprofit" as const,
  geographies: ["AZ"],
};

describe("deterministic factor boundaries", () => {
  it("geographic — national passes everything", () => {
    expect(scoreGeographic(["NATIONAL"], ["AZ"]).score).toBe(15);
  });
  it("geographic — direct overlap", () => {
    expect(scoreGeographic(["AZ", "NV"], ["AZ"]).score).toBe(15);
  });
  it("geographic — no overlap", () => {
    expect(scoreGeographic(["NY"], ["AZ"]).score).toBe(5);
  });
  it("budget — well-scaled award", () => {
    expect(scoreBudget(5000, 25_000, 250_000).score).toBe(15);
  });
  it("budget — award exceeds org capacity", () => {
    expect(scoreBudget(null, 500_000, 100_000).score).toBe(3);
  });
  it("prior — direct funder_id match", () => {
    const r = scorePriorRelationship("funder-1", "Foo Foundation", [
      { funder_id: "funder-1", funder_name: "Foo Foundation", amount: 10, year: 2024 },
    ]);
    expect(r.score).toBe(10);
  });
  it("prior — fuzzy name match", () => {
    const r = scorePriorRelationship("funder-x", "Arizona Community Foundation", [
      { funder_name: "arizona community", amount: null, year: null },
    ]);
    expect(r.score).toBe(7);
  });
  it("prior — no match", () => {
    const r = scorePriorRelationship("x", "Foo", []);
    expect(r.score).toBe(0);
  });
});

describe("eligibility scoring contract", () => {
  it("(d) requires 501c3 + org without it → 0", () => {
    const r = scoreEligibility({ requires_501c3: true }, { ...baseOrg, has_501c3: false });
    expect(r.score).toBe(0);
    expect(r.failed_rules.length).toBeGreaterThan(0);
  });
  it("(e) all bounds satisfied → 15", () => {
    const r = scoreEligibility(
      {
        requires_501c3: true,
        min_org_years: 3,
        min_org_budget: 50_000,
        max_org_budget: 5_000_000,
        allowed_org_types: ["nonprofit"],
        allowed_geographies: ["AZ"],
      },
      baseOrg,
    );
    expect(r.score).toBe(15);
    expect(r.failed_rules).toEqual([]);
  });
  it("(f) requires_501c3:false only → 15 (no other constraints)", () => {
    const r = scoreEligibility({ requires_501c3: false }, baseOrg);
    expect(r.score).toBe(15);
  });
  it("(g) allowed_geographies AZ intersects, and 'national' always passes", () => {
    const az = scoreEligibility(
      { requires_501c3: false, allowed_geographies: ["AZ"] },
      baseOrg,
    );
    expect(az.score).toBe(15);
    const nat = scoreEligibility(
      { requires_501c3: false, allowed_geographies: ["national"] },
      { ...baseOrg, geographies: ["NV"] },
    );
    expect(nat.score).toBe(15);
  });
  it("(h) malformed jsonb → 0, malformed message, never throws", () => {
    const r = scoreEligibility({ totally: "wrong" }, baseOrg);
    expect(r.score).toBe(0);
    expect(r.reasoning).toBe("malformed eligibility data");
    expect(r.failed_rules).toEqual(["malformed_schema"]);
  });
  it("custom_rules surface as manual_checks (never auto-evaluated)", () => {
    const r = scoreEligibility(
      {
        requires_501c3: true,
        custom_rules: ["Must serve veterans", "Board approval required"],
      },
      baseOrg,
    );
    expect(r.score).toBe(15);
    expect(r.manual_checks).toEqual([
      "Must serve veterans",
      "Board approval required",
    ]);
  });
});

describe("composeScore", () => {
  const org: OrgProfile = {
    org_id: "o1",
    ein: "12-3456789",
    org_name: "Jazmine's Journey",
    org_type: "nonprofit",
    has_501c3: true,
    years_operating: 14,
    annual_budget: 250_000,
    mission: "Comfort and dignity for hospitalized children.",
    focus_areas: ["pediatric"],
    populations_served: ["children"],
    geographies: ["AZ"],
    past_grants: [],
    updated_at: new Date().toISOString(),
  };
  const grant: Grant = {
    id: "g1",
    funder_id: "f1",
    name: "Test Grant",
    description: "test",
    amount_min: 5000,
    amount_max: 25_000,
    deadline: null,
    deadline_type: "rolling",
    eligibility: { requires_501c3: true, allowed_geographies: ["AZ"] },
    focus_areas: ["pediatric"],
    geographies: ["AZ"],
    source: "manual",
    source_url: null,
  };
  const funder: Funder = {
    id: "f1",
    ein: "999999999",
    name: "Test Funder",
    description: null,
    focus_areas: [],
    geographies: ["AZ"],
    total_assets: null,
    source: "manual",
    source_url: null,
  };

  it("(b) valid mission/population composes to expected total", () => {
    const r = composeScore({
      org,
      grant,
      funder,
      missionPop: {
        mission: { score: 28, reasoning: "match" },
        population: { score: 14, reasoning: "match" },
      },
    });
    // 28 + 15 + 15 + 15 + 14 + 0 = 87
    expect(r.score_total).toBe(87);
    expect(r.score_breakdown.eligibility.failed_rules).toEqual([]);
  });
});

describe("Haiku failure path (mission-population)", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://x";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "x";
    vi.resetModules();
  });
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("ai");
    vi.doUnmock("@ai-sdk/anthropic");
    vi.doUnmock("@/lib/supabase/admin");
  });
  it("(c) malformed JSON response → throws after retry", async () => {
    vi.doMock("ai", () => ({
      generateText: vi.fn().mockResolvedValue({ text: "this is not json at all" }),
    }));
    vi.doMock("@ai-sdk/anthropic", () => ({ anthropic: () => ({}) }));
    const mod = await import("@/lib/scoring/factors/mission-population");
    await expect(
      mod.scoreMissionAndPopulation({
        orgName: "x",
        orgMission: "x",
        orgFocusAreas: [],
        orgPopulationsServed: [],
        grantName: "x",
        grantDescription: null,
        grantFocusAreas: [],
        funderName: "x",
      }),
    ).rejects.toThrow();
  });

  it("runner writes match_scores.status='failed' with non-empty error_message on Haiku malformed output", async () => {
    vi.doMock("ai", () => ({
      generateText: vi.fn().mockResolvedValue({ text: "not json" }),
    }));
    vi.doMock("@ai-sdk/anthropic", () => ({ anthropic: () => ({}) }));

    type Row = Record<string, unknown>;
    const upserts: Array<{ table: string; row: Row }> = [];
    const fakeOrgRow = {
      org_id: "o1",
      ein: "12-3456789",
      org_name: "Org",
      org_type: "nonprofit",
      has_501c3: true,
      years_operating: 5,
      annual_budget: 100_000,
      mission: "m",
      focus_areas: [],
      populations_served: [],
      geographies: ["AZ"],
      past_grants: [],
      updated_at: new Date().toISOString(),
    };
    const fakeGrant = {
      id: "g1",
      funder_id: "f1",
      name: "G",
      description: "d",
      amount_min: 1000,
      amount_max: 10_000,
      deadline: null,
      deadline_type: "rolling",
      eligibility: { requires_501c3: true },
      focus_areas: [],
      geographies: ["AZ"],
      source: "manual",
      source_url: null,
    };
    const fakeFunder = {
      id: "f1",
      ein: "999",
      name: "F",
      description: null,
      focus_areas: [],
      geographies: ["AZ"],
      total_assets: null,
      source: "manual",
      source_url: null,
    };

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        from(table: string) {
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => {
                      if (table === "org_profiles") return { data: fakeOrgRow };
                      if (table === "grants") return { data: fakeGrant };
                      if (table === "funders") return { data: fakeFunder };
                      return { data: null };
                    },
                  };
                },
              };
            },
            upsert: async (row: Row) => {
              upserts.push({ table, row });
              return { error: null };
            },
          };
        },
      }),
    }));

    const runner = await import("@/lib/scoring/runner");
    await runner.computeOneScore("o1", "g1");

    const failed = upserts.find(
      (u) => u.table === "match_scores" && (u.row as Row).status === "failed",
    );
    expect(failed, "expected a match_scores upsert with status=failed").toBeTruthy();
    const errMsg = (failed!.row as Row).error_message as string;
    expect(typeof errMsg).toBe("string");
    expect(errMsg.length).toBeGreaterThan(0);
  });
});

describe("recomputeAllForOrg (Phase 1 escape hatch)", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://x";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "x";
    vi.resetModules();
  });
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/lib/supabase/admin");
    vi.doUnmock("@/lib/supabase/queries");
  });

  type Row = Record<string, unknown>;
  function makeFakeAdmin(rows: Array<{ grant_id: string; status: string }>) {
    const upserts: Array<{ table: string; rows: Row[] }> = [];
    const client = {
      from(table: string) {
        return {
          select() {
            return {
              eq() {
                return {
                  // recomputeAllNonComputedForOrg path: select(...).eq(...).in(...)
                  in: async () => ({
                    data: table === "match_scores" ? rows : [],
                  }),
                  // computeOneScore path: select(...).eq(...).maybeSingle()
                  // Return null so the loader fails fast and computeOneScore
                  // writes a 'failed' row instead of running the real pipeline.
                  maybeSingle: async () => ({ data: null }),
                };
              },
            };
          },
          upsert: async (payload: Row | Row[]) => {
            upserts.push({
              table,
              rows: Array.isArray(payload) ? payload : [payload],
            });
            return { error: null };
          },
        };
      },
      // The best-effort drain kicked after enqueue claims nothing here.
      rpc: async () => ({ data: [], error: null }),
    };
    return { client, upserts };
  }

  it("action requires org membership — throws when caller is not a member", async () => {
    vi.doMock("@/lib/supabase/queries", () => ({
      getCurrentUser: async () => ({ id: "user-1" }),
      getCurrentOrgId: async () => "different-org",
    }));
    const { client } = makeFakeAdmin([]);
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }));
    const { recomputeAllForOrg } = await import("@/lib/scoring/actions");
    await expect(recomputeAllForOrg("target-org")).rejects.toThrow(/Forbidden/);
  });

  it("flips qualifying rows (pending|computing|failed) back to pending with cleared error_message", async () => {
    const { client, upserts } = makeFakeAdmin([
      { grant_id: "g1", status: "computing" },
      { grant_id: "g2", status: "failed" },
      { grant_id: "g3", status: "pending" },
    ]);
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }));
    const runner = await import("@/lib/scoring/runner");

    await runner.recomputeAllNonComputedForOrg("o1");

    // First match_scores upsert should be the bulk requeue with 3 pending rows.
    const requeue = upserts.find(
      (u) => u.table === "match_scores" && u.rows.length === 3,
    );
    expect(requeue, "expected a bulk requeue upsert with 3 rows").toBeTruthy();
    for (const r of requeue!.rows) {
      expect(r.status).toBe("pending");
      expect(r.error_message).toBeNull();
    }
    // WS6: recompute is now ENQUEUE-ONLY. It no longer computes inline — the
    // drainer (kicked best-effort + pg_cron backstop) does the work via
    // claim_scoring_jobs. The mock claim returns nothing, so there must be no
    // single-row 'computing' upserts from an inline loop.
    const computingUpserts = upserts.filter(
      (u) =>
        u.table === "match_scores" &&
        u.rows.length === 1 &&
        u.rows[0].status === "computing",
    );
    expect(computingUpserts).toHaveLength(0);
  });

  it("no-ops when no rows are in pending|computing|failed (all already computed)", async () => {
    const { client, upserts } = makeFakeAdmin([]);
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }));
    const runner = await import("@/lib/scoring/runner");

    await runner.recomputeAllNonComputedForOrg("o1");

    expect(upserts).toHaveLength(0);
  });
});

describe("drainScoringJobs (WS6 durable queue)", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://x";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "x";
    vi.resetModules();
  });
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/lib/supabase/admin");
  });

  it("claims a batch, processes each, then stops when the queue drains", async () => {
    type Row = Record<string, unknown>;
    const upserts: Row[] = [];
    // First claim returns one job; second returns none → loop terminates.
    const claims: Array<Array<{ claimed_org_id: string; claimed_grant_id: string }>> = [
      [{ claimed_org_id: "o1", claimed_grant_id: "g1" }],
      [],
    ];
    const client = {
      from() {
        return {
          select() {
            return {
              eq() {
                // computeOneScore loaders → null so it writes a terminal 'failed'.
                return { maybeSingle: async () => ({ data: null }) };
              },
            };
          },
          upsert: async (payload: Row | Row[]) => {
            for (const r of Array.isArray(payload) ? payload : [payload]) upserts.push(r);
            return { error: null };
          },
        };
      },
      rpc: async () => ({ data: claims.shift() ?? [], error: null }),
    };
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }));
    const runner = await import("@/lib/scoring/runner");

    const result = await runner.drainScoringJobs({ batch: 5 });

    expect(result.processed).toBe(1);
    // The claimed job ran computeOneScore, which wrote a terminal row.
    const terminal = upserts.find(
      (r) => r.status === "failed" || r.status === "computed",
    );
    expect(terminal, "drain should process the claimed job to a terminal state").toBeTruthy();
  });

  it("stops immediately on claim error (no infinite loop)", async () => {
    const client = {
      from() {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) };
      },
      rpc: async () => ({ data: null, error: { message: "boom" } }),
    };
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }));
    const runner = await import("@/lib/scoring/runner");
    const result = await runner.drainScoringJobs();
    expect(result.processed).toBe(0);
    expect(result.batches).toBe(0);
  });
});
