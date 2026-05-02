import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

let cached: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Service-role client. Server-only. Bypasses RLS.
 * Use sparingly: seed scripts and trusted server actions only.
 */
export function createAdminClient() {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.",
    );
  }
  cached = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
