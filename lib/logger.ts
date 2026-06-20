type Area =
  | "auth"
  | "onboarding"
  | "scoring"
  | "chat"
  | "seed"
  | "propublica"
  | "grantsgov"
  | "supabase"
  | "api";

export function log(area: Area, msg: string, meta?: Record<string, unknown>) {
  const payload = meta ? ` ${JSON.stringify(meta)}` : "";
  console.log(`[grantmatch:${area}] ${msg}${payload}`);
}

export function logError(area: Area, msg: string, err: unknown) {
  const m = err instanceof Error ? err.message : String(err);
  console.error(`[grantmatch:${area}] ${msg} :: ${m}`);
}
