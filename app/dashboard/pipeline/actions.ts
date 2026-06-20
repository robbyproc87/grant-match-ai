"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getCurrentOrgId } from "@/lib/supabase/queries";
import { log, logError } from "@/lib/logger";

export const APPLICATION_STATUSES = [
  "identified",
  "drafting",
  "submitted",
  "won",
  "lost",
  "declined",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

type Result<T = undefined> =
  | ({ ok: true } & (T extends undefined ? {} : { data: T }))
  | { ok: false; error: string };

/**
 * Resolve the caller's org from the session. All writes below go through the
 * user-scoped client, so RLS (is_org_member) is the real authorization gate —
 * this just gives us the org_id to stamp on inserts.
 */
async function callerOrgId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return getCurrentOrgId(user.id);
}

/** Add a grant to the pipeline (idempotent on org+grant). Snapshots the deadline. */
export async function addToPipeline(grantId: string): Promise<Result> {
  try {
    if (!grantId) return { ok: false, error: "Missing grant." };
    const orgId = await callerOrgId();
    if (!orgId) return { ok: false, error: "Not signed in." };
    const sb = createClient();
    const { data: grant } = await sb
      .from("grants")
      .select("deadline")
      .eq("id", grantId)
      .maybeSingle<{ deadline: string | null }>();
    const { error } = await sb.from("applications").upsert(
      {
        org_id: orgId,
        grant_id: grantId,
        status: "identified",
        deadline: grant?.deadline ?? null,
      } as never,
      { onConflict: "org_id,grant_id" },
    );
    if (error) throw error;
    log("api", "added to pipeline", { orgId, grantId });
    revalidatePath("/dashboard/pipeline");
    return { ok: true };
  } catch (err) {
    logError("api", "addToPipeline failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "failed" };
  }
}

/** Move an application to a new lifecycle status. RLS scopes the update to the caller's org. */
export async function updateApplicationStatus(
  applicationId: string,
  status: ApplicationStatus,
): Promise<Result> {
  try {
    if (!APPLICATION_STATUSES.includes(status)) {
      return { ok: false, error: "Invalid status." };
    }
    const orgId = await callerOrgId();
    if (!orgId) return { ok: false, error: "Not signed in." };
    const sb = createClient();
    const { error } = await sb
      .from("applications")
      .update({ status } as never)
      .eq("id", applicationId)
      .eq("org_id", orgId);
    if (error) throw error;
    revalidatePath("/dashboard/pipeline");
    return { ok: true };
  } catch (err) {
    logError("api", "updateApplicationStatus failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "failed" };
  }
}

/** Persist the per-application checklist (replaces throwaway client state). */
export async function setApplicationChecklist(
  applicationId: string,
  checklist: Record<string, boolean>,
): Promise<Result> {
  try {
    const orgId = await callerOrgId();
    if (!orgId) return { ok: false, error: "Not signed in." };
    const sb = createClient();
    const { error } = await sb
      .from("applications")
      .update({ checklist } as never)
      .eq("id", applicationId)
      .eq("org_id", orgId);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    logError("api", "setApplicationChecklist failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "failed" };
  }
}

/** Remove an application from the pipeline. */
export async function removeFromPipeline(applicationId: string): Promise<Result> {
  try {
    const orgId = await callerOrgId();
    if (!orgId) return { ok: false, error: "Not signed in." };
    const sb = createClient();
    const { error } = await sb
      .from("applications")
      .delete()
      .eq("id", applicationId)
      .eq("org_id", orgId);
    if (error) throw error;
    revalidatePath("/dashboard/pipeline");
    return { ok: true };
  } catch (err) {
    logError("api", "removeFromPipeline failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "failed" };
  }
}
