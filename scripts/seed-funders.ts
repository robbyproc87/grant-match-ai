import "dotenv/config";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import { propublicaAdapter } from "@/lib/sources/propublica";
import { CURATED_FUNDER_NAMES } from "./seed-funders-list";
import { FUNDER_EIN_OVERRIDES } from "./seed-funders-overrides";

const STOPWORDS = new Set([
  "foundation", "fund", "funds", "inc", "incorporated", "the", "of", "for",
  "and", "charitable", "trust", "co", "company", "society", "association",
  "organization", "org", "az", "usa",
]);

function normalizeTokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t)),
  );
}

function tokenOverlap(query: string, candidate: string): number {
  const q = normalizeTokens(query);
  const c = normalizeTokens(candidate);
  if (q.size === 0) return 0;
  let hit = 0;
  for (const t of q) if (c.has(t)) hit++;
  return hit / q.size;
}

/**
 * Sanitize a funder name for ProPublica search. ProPublica's search.json
 * returns HTTP 404 (not empty results) on queries containing parens, plus
 * signs, or certain other punctuation. Strip these before sending. The
 * original (human-readable) seed-list name is preserved for display.
 */
function sanitizeForSearch(name: string): string {
  return name
    .replace(/\s*\([^)]*\)\s*$/g, "") // trailing "(AZ)", "(USA)", etc.
    .replace(/\+/g, " plus ")
    .replace(/\s+/g, " ")
    .trim();
}

interface Resolved {
  searchName: string;
  ein: string;
  matchedName: string;
  score: number;
  warning?: string;
}

async function main() {
  const sb = createAdminClient();
  const total = CURATED_FUNDER_NAMES.length;
  const resolved: Resolved[] = [];
  const unmatched: string[] = [];
  const warnings: string[] = [];
  let ok = 0;

  for (let i = 0; i < total; i++) {
    const searchName = CURATED_FUNDER_NAMES[i];
    console.log(`Seeding ${i + 1}/${total}: ${searchName}`);
    try {
      const overrideEin = FUNDER_EIN_OVERRIDES[searchName];
      let top: { ein: number; name: string; score: number } | undefined;

      if (overrideEin) {
        const cleaned = overrideEin.replace(/\D/g, "").padStart(9, "0");
        console.log(
          `   → using override EIN ${cleaned.replace(/(\d{2})(\d{7})/, "$1-$2")} ✅`,
        );
        const details = await propublicaAdapter.getFoundationDetails(cleaned);
        if (!details) {
          console.error(`   ❌ override EIN ${cleaned} returned no details`);
          unmatched.push(`${searchName} (override ${cleaned} not found)`);
          await new Promise((r) => setTimeout(r, 250));
          continue;
        }
        // Sanity check: detail name should still token-overlap the query.
        const overlap = tokenOverlap(searchName, details.name);
        if (overlap < 0.6) {
          const w = `'${searchName}' override → '${details.name}' (overlap ${(overlap * 100).toFixed(0)}%) — verify EIN`;
          console.log(`   ⚠️  WARNING: ${w}`);
          warnings.push(w);
        }
        top = { ein: Number(cleaned), name: details.name, score: -1 };
        const row = {
          ein: cleaned,
          name: details.name,
          description: details.description ?? null,
          focus_areas: [],
          geographies: details.state ? [details.state.toUpperCase()] : ["NATIONAL"],
          total_assets: details.total_assets ?? null,
          source: "propublica",
          source_url: details.source_url,
        };
        const { error } = await sb.from("funders").upsert(row, { onConflict: "ein" });
        if (error) throw error;
        resolved.push({ searchName, ein: cleaned, matchedName: details.name, score: -1 });
        ok++;
        await new Promise((r) => setTimeout(r, 250));
        continue;
      }

      // No override → search-and-resolve
      const sanitized = sanitizeForSearch(searchName);
      if (sanitized !== searchName) {
        console.log(`   (sanitized query: '${sanitized}')`);
      }
      const hits = await propublicaAdapter.searchFoundations(sanitized);
      try {
        const raw = await fetch(
          `https://projects.propublica.org/nonprofits/api/v2/search.json?q=${encodeURIComponent(sanitized)}`,
          { headers: { "User-Agent": "GrantMatchAI/0.1" } },
        );
        if (raw.ok) {
          const rawJson = (await raw.json()) as {
            organizations: Array<{ ein: number; name: string; score: number }>;
          };
          top = rawJson.organizations?.[0];
        }
      } catch {
        // fall through to hits[0]
      }
      if (!top && hits[0]) {
        top = { ein: Number(hits[0].ein.replace(/\D/g, "")), name: hits[0].name, score: 0 };
      }
      if (!top || hits.length === 0) {
        console.log(`   ❌ no results`);
        unmatched.push(searchName);
        await new Promise((r) => setTimeout(r, 250));
        continue;
      }
      const ein = String(top.ein).padStart(9, "0");
      const overlap = tokenOverlap(searchName, top.name);
      const matchOk = overlap >= 0.6;
      const tag = matchOk ? "✅" : "⚠️ ";
      console.log(
        `   → matched '${top.name}' (score: ${top.score.toFixed(0)}, EIN: ${ein.replace(/(\d{2})(\d{7})/, "$1-$2")}) ${tag}`,
      );
      if (!matchOk) {
        const w = `'${searchName}' → top hit '${top.name}' (overlap ${(overlap * 100).toFixed(0)}%) — verify intended org or rename in seed list`;
        console.log(`   ⚠️  WARNING: ${w}`);
        warnings.push(w);
      }
      const details = await propublicaAdapter.getFoundationDetails(ein);
      const row = {
        ein,
        name: details?.name ?? top.name,
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
      resolved.push({
        searchName,
        ein,
        matchedName: top.name,
        score: top.score,
        warning: matchOk ? undefined : `low overlap ${(overlap * 100).toFixed(0)}%`,
      });
      ok++;
    } catch (err) {
      console.error(`   ❌ failed:`, err instanceof Error ? err.message : err);
      unmatched.push(searchName);
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  const sidecar = join(process.cwd(), "scripts", ".seed-funders-resolved.json");
  writeFileSync(
    sidecar,
    JSON.stringify(
      Object.fromEntries(resolved.map((r) => [r.searchName, r.ein])),
      null,
      2,
    ),
  );
  console.log(`\n📝 wrote ${sidecar} (${resolved.length} entries)`);

  console.log(`\n✅ ${ok} seeded, ⚠️  ${warnings.length} warnings, ❌ ${unmatched.length} unmatched`);
  if (warnings.length) {
    console.log(`\nWarnings:`);
    for (const w of warnings) console.log(`  - ${w}`);
  }
  if (unmatched.length) {
    console.log(`\nUnmatched:`);
    for (const u of unmatched) console.log(`  - ${u}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
