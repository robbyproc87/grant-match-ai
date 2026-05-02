import "dotenv/config";
import { spawnSync } from "node:child_process";

function run(name: string) {
  console.log(`\n=== ${name} ===`);
  const res = spawnSync("npx", ["tsx", `scripts/${name}.ts`], {
    stdio: "inherit",
  });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

run("seed-funders");
run("seed-grants");
