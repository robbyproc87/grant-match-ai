import "dotenv/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { propublicaAdapter } from "@/lib/sources/propublica";
import { CURATED_FUNDER_EINS } from "./seed-funders-list";

async function main() {
  const sb = createAdminClient();
  const total = CURATED_FUNDER_EINS.length;
  let ok = 0;
  const failed: string[] = [];

  for (let i = 0; i < total; i++) {
    const { ein, fallbackName } = CURATED_FUNDER_EINS[i];
    console.log(`Seeding ${i + 1}/${total}: EIN ${ein} (${fallbackName})`);
    try {
      const details = await propublicaAdapter.getFoundationDetails(ein);
      const row = {
        ein,
        name: details?.name ?? fallbackName,
        description: details?.description ?? null,
        focus_areas: [],
        geographies: details?.state ? [details.state.toUpperCase()] : ["NATIONAL"],
        total_assets: details?.total_assets ?? null,
        source: "propublica",
        source_url:
          details?.source_url ??
          `https://projects.propublica.org/nonprofits/organizations/${ein}`,
      };
      const { error } = await sb.from("funders").upsert(row, { onConflict: "ein" });
      if (error) throw error;
      ok++;
    } catch (err) {
      console.error(`  ❌ ${ein} failed:`, err instanceof Error ? err.message : err);
      failed.push(ein);
    }
    // 250ms delay between requests
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`\n✅ ${ok} seeded, ❌ ${failed.length} failed${failed.length ? `: [${failed.join(", ")}]` : ""}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
