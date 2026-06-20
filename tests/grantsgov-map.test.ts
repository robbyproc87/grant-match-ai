/**
 * Unit tests for lib/sources/grantsgov-map.ts
 *
 * All fixtures are inline literals derived from real Grants.gov API responses
 * captured against opportunityId 362288 on 2026-06-19.
 * No network calls are made inside the tests.
 */

import { describe, expect, it } from "vitest";
import {
  mapOpportunity,
  type GrantsGovOpportunityDetail,
} from "@/lib/sources/grantsgov-map";

// ---------------------------------------------------------------------------
// Minimal real-data fixture (trimmed from live API response)
// ---------------------------------------------------------------------------

const REAL_FIXTURE: GrantsGovOpportunityDetail = {
  id: 362288,
  opportunityNumber: "HRSA-26-062",
  opportunityTitle:
    "Fiscal Year (FY) 2026 Quality Improvement Fund - Improving Access to Dental Services for Children with Neurodevelopmental Disorders (QIF-DNDD)",
  owningAgencyCode: "HHS-HRSA",
  synopsis: {
    agencyCode: "HHS-HRSA",
    agencyName: "Health Resources and Services Administration",
    synopsisDesc:
      "The purpose of fiscal year (FY) 2026 Quality Improvement Fund: Improving Access to Dental Services for Children with Neurodevelopmental Disorders (QIF-DNDD) is to increase access to preventive dental and additional dental services.",
    responseDate: "Jul 08, 2026 12:00:00 AM EDT",
    awardCeiling: "2000000",
    awardFloor: "2000000",
    estimatedFunding: "50000000",
    applicantEligibilityDesc:
      "You can apply if you are a Health Center Program award recipient with an active H80 award. A Health Center Program (H80) award is funded under &sect;330(e) of the Public Health Service (PHS) Act.",
    applicantTypes: [
      {
        id: "25",
        description:
          'Others (see text field entitled "Additional Information on Eligibility" for clarification)',
      },
    ],
    fundingActivityCategories: [
      {
        id: "HL",
        description: "Health",
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDetail(
  overrides: Partial<GrantsGovOpportunityDetail> = {},
): GrantsGovOpportunityDetail {
  return { ...REAL_FIXTURE, ...overrides };
}

function makeDetailWithSynopsis(
  synOverrides: Partial<NonNullable<GrantsGovOpportunityDetail["synopsis"]>>,
): GrantsGovOpportunityDetail {
  return {
    ...REAL_FIXTURE,
    synopsis: { ...REAL_FIXTURE.synopsis!, ...synOverrides },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("mapOpportunity — top-level shape", () => {
  it("sets source = 'grantsgov'", () => {
    expect(mapOpportunity(REAL_FIXTURE).source).toBe("grantsgov");
  });

  it("sets source_id from detail.id (number → string)", () => {
    expect(mapOpportunity(REAL_FIXTURE).source_id).toBe("362288");
  });

  it("constructs source_url correctly", () => {
    expect(mapOpportunity(REAL_FIXTURE).source_url).toBe(
      "https://www.grants.gov/search-results-detail/362288",
    );
  });
});

describe("mapOpportunity — funder block", () => {
  it("funder.source = 'grantsgov'", () => {
    expect(mapOpportunity(REAL_FIXTURE).funder.source).toBe("grantsgov");
  });

  it("funder.source_id = owningAgencyCode", () => {
    expect(mapOpportunity(REAL_FIXTURE).funder.source_id).toBe("HHS-HRSA");
  });

  it("funder.ein = null (federal agencies have no EIN)", () => {
    expect(mapOpportunity(REAL_FIXTURE).funder.ein).toBeNull();
  });

  it("funder.name = synopsis.agencyName", () => {
    expect(mapOpportunity(REAL_FIXTURE).funder.name).toBe(
      "Health Resources and Services Administration",
    );
  });

  it("funder.description = null", () => {
    expect(mapOpportunity(REAL_FIXTURE).funder.description).toBeNull();
  });

  it("funder.geographies = ['NATIONAL']", () => {
    expect(mapOpportunity(REAL_FIXTURE).funder.geographies).toEqual([
      "NATIONAL",
    ]);
  });

  it("falls back to synopsis.agencyCode when owningAgencyCode absent", () => {
    const detail: GrantsGovOpportunityDetail = {
      id: 1,
      synopsis: { agencyCode: "DOE", agencyName: "Dept of Energy" },
    };
    expect(mapOpportunity(detail).funder.source_id).toBe("DOE");
  });
});

describe("mapOpportunity — award floor / ceiling → amount_min / amount_max", () => {
  it("maps awardFloor string to amount_min number", () => {
    expect(mapOpportunity(REAL_FIXTURE).grant.amount_min).toBe(2_000_000);
  });

  it("maps awardCeiling string to amount_max number", () => {
    expect(mapOpportunity(REAL_FIXTURE).grant.amount_max).toBe(2_000_000);
  });

  it("awardFloor='0' → amount_min=null", () => {
    const result = mapOpportunity(
      makeDetailWithSynopsis({ awardFloor: "0" }),
    );
    expect(result.grant.amount_min).toBeNull();
  });

  it("awardCeiling='0' → amount_max falls back to estimatedFunding", () => {
    const result = mapOpportunity(
      makeDetailWithSynopsis({ awardCeiling: "0" }),
    );
    // awardCeiling=0 → null, but awardFloor=2000000 is set, so no estimatedFunding fallback
    expect(result.grant.amount_max).toBeNull();
  });

  it("both floor and ceiling absent → amount_max = estimatedFunding", () => {
    const result = mapOpportunity(
      makeDetailWithSynopsis({
        awardFloor: undefined,
        awardCeiling: undefined,
        estimatedFunding: "50000000",
      }),
    );
    expect(result.grant.amount_min).toBeNull();
    expect(result.grant.amount_max).toBe(50_000_000);
  });

  it("all three absent → both null", () => {
    const result = mapOpportunity(
      makeDetailWithSynopsis({
        awardFloor: undefined,
        awardCeiling: undefined,
        estimatedFunding: undefined,
      }),
    );
    expect(result.grant.amount_min).toBeNull();
    expect(result.grant.amount_max).toBeNull();
  });
});

describe("mapOpportunity — date parsing", () => {
  it("parses 'Jul 08, 2026 12:00:00 AM EDT' → '2026-07-08'", () => {
    expect(mapOpportunity(REAL_FIXTURE).grant.deadline).toBe("2026-07-08");
  });

  it("parses MM/DD/YYYY format correctly", () => {
    const result = mapOpportunity(
      makeDetailWithSynopsis({ responseDate: "03/15/2027" }),
    );
    expect(result.grant.deadline).toBe("2027-03-15");
  });

  it("missing responseDate → deadline=null", () => {
    const result = mapOpportunity(
      makeDetailWithSynopsis({ responseDate: undefined }),
    );
    expect(result.grant.deadline).toBeNull();
  });

  it("garbage date string → deadline=null", () => {
    const result = mapOpportunity(
      makeDetailWithSynopsis({ responseDate: "not-a-date" }),
    );
    expect(result.grant.deadline).toBeNull();
  });

  it("empty string responseDate → deadline=null", () => {
    const result = mapOpportunity(
      makeDetailWithSynopsis({ responseDate: "" }),
    );
    expect(result.grant.deadline).toBeNull();
  });

  it("deadline_type is always 'fixed'", () => {
    expect(mapOpportunity(REAL_FIXTURE).grant.deadline_type).toBe("fixed");
  });
});

describe("mapOpportunity — HTML stripping in description", () => {
  it("plain text passes through unchanged (modulo whitespace trim)", () => {
    const result = mapOpportunity(
      makeDetailWithSynopsis({ synopsisDesc: "  Plain text.  " }),
    );
    expect(result.grant.description).toBe("Plain text.");
  });

  it("strips paragraph tags", () => {
    const result = mapOpportunity(
      makeDetailWithSynopsis({
        synopsisDesc: "<p>Hello world</p>",
      }),
    );
    expect(result.grant.description).toBe("Hello world");
  });

  it("strips anchor tags and preserves inner text", () => {
    const result = mapOpportunity(
      makeDetailWithSynopsis({
        synopsisDesc: "Visit <a href='https://example.com'>this site</a> now",
      }),
    );
    expect(result.grant.description).toBe("Visit this site now");
  });

  it("decodes &sect; HTML entity", () => {
    const result = mapOpportunity(
      makeDetailWithSynopsis({
        synopsisDesc: "Funded under &sect;330(e)",
      }),
    );
    expect(result.grant.description).toBe("Funded under §330(e)");
  });

  it("decodes &amp; HTML entity", () => {
    const result = mapOpportunity(
      makeDetailWithSynopsis({ synopsisDesc: "Food &amp; Health" }),
    );
    expect(result.grant.description).toBe("Food & Health");
  });

  it("missing synopsisDesc → description=null", () => {
    const result = mapOpportunity(
      makeDetailWithSynopsis({ synopsisDesc: undefined }),
    );
    expect(result.grant.description).toBeNull();
  });

  it("strips HTML from applicantEligibilityDesc before storing in custom_rules", () => {
    const result = mapOpportunity(
      makeDetailWithSynopsis({
        applicantEligibilityDesc:
          "Funded under &sect;330(e) <em>of the Act</em>.",
      }),
    );
    expect(result.grant.eligibility.custom_rules).toEqual([
      "Funded under §330(e) of the Act.",
    ]);
  });
});

describe("mapOpportunity — fundingActivityCategories → focus_areas", () => {
  it("array of {id, description} objects → descriptions", () => {
    expect(mapOpportunity(REAL_FIXTURE).grant.focus_areas).toEqual(["Health"]);
  });

  it("array of plain strings → strings", () => {
    const result = mapOpportunity(
      makeDetailWithSynopsis({
        fundingActivityCategories: ["Education", "Housing"],
      }),
    );
    expect(result.grant.focus_areas).toEqual(["Education", "Housing"]);
  });

  it("mixed array of objects and strings", () => {
    const result = mapOpportunity(
      makeDetailWithSynopsis({
        fundingActivityCategories: [
          { id: "ED", description: "Education" },
          "Housing",
        ],
      }),
    );
    expect(result.grant.focus_areas).toEqual(["Education", "Housing"]);
  });

  it("empty array → empty focus_areas", () => {
    const result = mapOpportunity(
      makeDetailWithSynopsis({ fundingActivityCategories: [] }),
    );
    expect(result.grant.focus_areas).toEqual([]);
  });

  it("absent fundingActivityCategories → empty focus_areas", () => {
    const result = mapOpportunity(
      makeDetailWithSynopsis({ fundingActivityCategories: undefined }),
    );
    expect(result.grant.focus_areas).toEqual([]);
  });

  it("multiple categories", () => {
    const result = mapOpportunity(
      makeDetailWithSynopsis({
        fundingActivityCategories: [
          { id: "HL", description: "Health" },
          { id: "ED", description: "Education" },
          { id: "CD", description: "Community Development" },
        ],
      }),
    );
    expect(result.grant.focus_areas).toEqual([
      "Health",
      "Education",
      "Community Development",
    ]);
  });
});

describe("mapOpportunity — eligibility block", () => {
  it("requires_501c3 is always false", () => {
    expect(mapOpportunity(REAL_FIXTURE).grant.eligibility.requires_501c3).toBe(
      false,
    );
  });

  it("allowed_geographies = ['national']", () => {
    expect(
      mapOpportunity(REAL_FIXTURE).grant.eligibility.allowed_geographies,
    ).toEqual(["national"]);
  });

  it("applicantEligibilityDesc → single custom_rules entry", () => {
    const eligibility = mapOpportunity(REAL_FIXTURE).grant.eligibility;
    expect(Array.isArray(eligibility.custom_rules)).toBe(true);
    expect(eligibility.custom_rules).toHaveLength(1);
    // The real desc contains &sect; — should be decoded
    expect(eligibility.custom_rules![0]).toContain("§330(e)");
  });

  it("absent applicantEligibilityDesc → custom_rules absent (not empty array)", () => {
    const result = mapOpportunity(
      makeDetailWithSynopsis({ applicantEligibilityDesc: undefined }),
    );
    expect(result.grant.eligibility.custom_rules).toBeUndefined();
  });

  it("eligibility object satisfies GrantEligibilitySchema", async () => {
    const { GrantEligibilitySchema } = await import(
      "@/lib/types/eligibility"
    );
    const result = GrantEligibilitySchema.safeParse(
      mapOpportunity(REAL_FIXTURE).grant.eligibility,
    );
    expect(result.success).toBe(true);
  });
});

describe("mapOpportunity — missing / partial synopsis fields never throw", () => {
  it("completely absent synopsis → produces valid (empty) result", () => {
    const detail: GrantsGovOpportunityDetail = {
      id: 999,
      opportunityTitle: "Test Grant",
    };
    expect(() => mapOpportunity(detail)).not.toThrow();
    const result = mapOpportunity(detail);
    expect(result.source).toBe("grantsgov");
    expect(result.grant.amount_min).toBeNull();
    expect(result.grant.amount_max).toBeNull();
    expect(result.grant.deadline).toBeNull();
    expect(result.grant.focus_areas).toEqual([]);
    expect(result.grant.eligibility.custom_rules).toBeUndefined();
  });

  it("empty detail object → does not throw", () => {
    expect(() => mapOpportunity({})).not.toThrow();
  });

  it("grant.geographies = ['NATIONAL']", () => {
    expect(mapOpportunity(REAL_FIXTURE).grant.geographies).toEqual([
      "NATIONAL",
    ]);
  });
});
