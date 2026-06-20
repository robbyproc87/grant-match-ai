import "dotenv/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { grantsgovAdapter } from "@/lib/sources/grantsgov";
import type { NormalizedOpportunity } from "@/lib/sources/grant-source";

/**
 * Ingest open opportunities from Grants.gov into `funders` + `grants`.
 * Idempotent: funders upsert on (source, source_id), grants on (source, source_id),
 * so re-running refreshes rather than duplicates. Requires migration 0004.
 *
 * Usage: npm run ingest:grantsgov  (keywords overridable via GRANTSGOV_KEYWORDS,
 * comma-separated; defaults tuned to the pediatric-health launch tenant).
 */
const DEFAULT_KEYWORDS = [
  "children health",
  "pediatric",
  "childhood cancer",
  "youth services",
  "child welfare",
];

async function upsertFunder(
  sb: ReturnType<typeof createAdminClient>,
  f: NormalizedOpportunity["funder"],
): Promise<string | null> {
  const { data, error } = await sb
    .from("funders")
    .upsert(
      {
        source: f.source,
        source_id: f.source_id,
        ein: f.ein,
        name: f.name,
        description: f.description,
        geographies: f.geographies,
      },
      { onConflict: "source,source_id" },
    )
    .select("id")
    .maybeSingle();
  if (error) {
    console.error(`   ❌ funder upsert failed (${f.name}):`, error.message);
    return null;
  }
  return (data?.id as string) ?? null;
}

async function main() {
  const sb = createAdminClient();
  const keywords = (process.env.GRANTSGOV_KEYWORDS?.split(",").map((k) => k.trim()).filter(Boolean)) ?? DEFAULT_KEYWORDS;
  const limit = Number(process.env.GRANTSGOV_LIMIT ?? 25);

  console.log(`Fetching Grants.gov opportunities for: ${keywords.join(", ")}`);
  const opps = await grantsgovAdapter.fetchOpportunities({ keywords, limit });
  console.log(`Normalized ${opps.length} unique opportunities.\n`);

  let grantsOk = 0;
  const failed: string[] = [];
  const funderCache = new Map<string, string>(); // source_id -> funder uuid

  for (let i = 0; i < opps.length; i++) {
    const o = opps[i];
    console.log(`Ingesting ${i + 1}/${opps.length}: ${o.grant.name.slice(0, 70)}`);
    try {
      let funderId = funderCache.get(o.funder.source_id);
      if (!funderId) {
        const id = await upsertFunder(sb, o.funder);
        if (!id) {
          failed.push(o.grant.name);
          continue;
        }
        funderId = id;
        funderCache.set(o.funder.source_id, id);
      }

      const { error } = await sb.from("grants").upsert(
        {
          funder_id: funderId,
          name: o.grant.name,
          description: o.grant.description,
          amount_min: o.grant.amount_min,
          amount_max: o.grant.amount_max,
          deadline: o.grant.deadline,
          deadline_type: o.grant.deadline_type,
          eligibility: o.grant.eligibility,
          focus_areas: o.grant.focus_areas,
          geographies: o.grant.geographies,
          source: o.source,
          source_id: o.source_id,
          source_url: o.source_url,
        },
        { onConflict: "source,source_id" },
      );
      if (error) throw error;
      grantsOk++;
    } catch (err) {
      console.error(`   ❌ failed:`, err instanceof Error ? err.message : err);
      failed.push(o.grant.name);
    }
  }

  console.log(
    `\n✅ ${grantsOk} grants ingested from ${funderCache.size} funders, ❌ ${failed.length} failed`,
  );
  if (failed.length) for (const f of failed) console.log(`  - ${f}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
