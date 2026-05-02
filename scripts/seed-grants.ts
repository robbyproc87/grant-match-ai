import "dotenv/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { CURATED_GRANTS } from "./seed-grants-list";

async function main() {
  const sb = createAdminClient();
  let ok = 0;
  const failed: string[] = [];

  for (let i = 0; i < CURATED_GRANTS.length; i++) {
    const g = CURATED_GRANTS[i];
    console.log(`Seeding grant ${i + 1}/${CURATED_GRANTS.length}: ${g.name}`);
    try {
      const { data: funder, error: funderErr } = await sb
        .from("funders")
        .select("id")
        .eq("ein", g.funder_ein)
        .maybeSingle();
      if (funderErr) throw funderErr;
      if (!funder) {
        console.warn(`  ⚠️  funder not found for EIN ${g.funder_ein} — skipping`);
        failed.push(g.name);
        continue;
      }
      const row = {
        funder_id: funder.id,
        name: g.name,
        description: g.description,
        amount_min: g.amount_min,
        amount_max: g.amount_max,
        deadline: g.deadline,
        deadline_type: g.deadline_type,
        eligibility: g.eligibility,
        focus_areas: g.focus_areas,
        geographies: g.geographies,
        source: "manual",
        source_url: g.source_url,
      };
      const { error } = await sb
        .from("grants")
        .upsert(row, { onConflict: "funder_id,name" });
      if (error) throw error;
      ok++;
    } catch (err) {
      console.error(`  ❌ failed:`, err instanceof Error ? err.message : err);
      failed.push(g.name);
    }
    // Light backoff for parity with funder seeding — keeps us friendly to Supabase.
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\n✅ ${ok} grants seeded, ❌ ${failed.length} failed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
