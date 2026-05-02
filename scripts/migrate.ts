import "dotenv/config";
import { Client } from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error(
      "Missing SUPABASE_DB_URL. Get it from Supabase → Project Settings → Database (Connection string).",
    );
    process.exit(1);
  }
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const dir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = readFileSync(join(dir, file), "utf8");
    console.log(`→ applying ${file}`);
    await client.query(sql);
  }
  await client.end();
  console.log("✅ migrations applied");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
