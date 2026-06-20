import { drainScoringJobs } from "@/lib/scoring/runner";
import { log, logError } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;
// Never cache — this mutates the queue.
export const dynamic = "force-dynamic";

/**
 * Durable scoring-queue drainer. Intended to be invoked on a schedule by
 * pg_cron + pg_net (see supabase/migrations/0005_scoring_queue.sql header for
 * the cron.schedule snippet). Guarded by a shared secret so it can't be
 * triggered by anonymous traffic.
 */
async function handle(req: Request): Promise<Response> {
  const secret = process.env.INTERNAL_DRAIN_SECRET;
  if (!secret) {
    logError("scoring", "drain route called but INTERNAL_DRAIN_SECRET unset", null);
    return new Response("Drain not configured", { status: 503 });
  }
  const provided =
    req.headers.get("x-internal-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== secret) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const result = await drainScoringJobs();
    log("scoring", "drain route ok", result);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    logError("scoring", "drain route exception", err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "drain failed" },
      { status: 500 },
    );
  }
}

// Accept POST (pg_net) and GET (manual / uptime ping) — both gated by the secret.
export const POST = handle;
export const GET = handle;
