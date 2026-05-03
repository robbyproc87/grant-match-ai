import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import { CURATED_GRANTS } from "./seed-grants-list";

async function main() {
  const sb = createAdminClient();
  const sidecar = join(process.cwd(), "scripts", ".seed-funders-resolved.json");
  if (!existsSync(sidecar)) {
    console.error(
      `Missing ${sidecar}. Run "npm run seed:funders" first so funder names resolve to EINs.`,
    );
    process.exit(1);
  }
  const nameToEin = JSON.parse(readFileSync(sidecar, "utf8")) as Record<string, string>;

  let ok = 0;
  const failed: string[] = [];
  const orphans: string[] = [];

  for (let i = 0; i < CURATED_GRANTS.length; i++) {
    const g = CURATED_GRANTS[i];
    console.log(`Seeding grant ${i + 1}/${CURATED_GRANTS.length}: ${g.name}`);
    try {
      const ein = nameToEin[g.funder_name];
      if (!ein) {
        console.warn(`   ⚠️  funder '${g.funder_name}' not in resolved sidecar — skipping`);
        orphans.push(`${g.name} (funder: ${g.funder_name})`);
        continue;
      }
      const { data: funder, error: funderErr } = await sb
        .from("funders")
        .select("id")
        .eq("ein", ein)
        .maybeSingle();
      if (funderErr) throw funderErr;
      if (!funder) {
        console.warn(`   ⚠️  funder row not found for EIN ${ein} (${g.funder_name}) — skipping`);
        orphans.push(`${g.name} (funder: ${g.funder_name}, ein: ${ein})`);
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
      console.error(`   ❌ failed:`, err instanceof Error ? err.message : err);
      failed.push(g.name);
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(
    `\n✅ ${ok} grants seeded, ⚠️  ${orphans.length} skipped (funder not in seed list), ❌ ${failed.length} failed`,
  );
  if (orphans.length) {
    console.log(`\nOrphan grants (funder name not in CURATED_FUNDER_NAMES):`);
    for (const o of orphans) console.log(`  - ${o}`);
  }
  if (failed.length) {
    console.log(`\nFailed grants:`);
    for (const f of failed) console.log(`  - ${f}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
