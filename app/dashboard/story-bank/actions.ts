"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getCurrentOrgId } from "@/lib/supabase/queries";
import { logError } from "@/lib/logger";
import type { StoryKind } from "@/lib/types/db";

export const STORY_KINDS: StoryKind[] = [
  "impact_stat",
  "testimonial",
  "program",
  "narrative",
  "other",
];

type Result = { ok: true } | { ok: false; error: string };

async function callerOrgId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return getCurrentOrgId(user.id);
}

export async function createStoryBlock(input: {
  kind: StoryKind;
  title: string;
  content: string;
  tags?: string[];
}): Promise<Result> {
  try {
    if (!STORY_KINDS.includes(input.kind)) return { ok: false, error: "Invalid kind." };
    if (!input.title.trim()) return { ok: false, error: "Title required." };
    const orgId = await callerOrgId();
    if (!orgId) return { ok: false, error: "Not signed in." };
    const sb = createClient();
    const { error } = await sb.from("story_blocks").insert({
      org_id: orgId,
      kind: input.kind,
      title: input.title.trim(),
      content: input.content ?? "",
      tags: input.tags ?? [],
    } as never);
    if (error) throw error;
    revalidatePath("/dashboard/story-bank");
    return { ok: true };
  } catch (err) {
    logError("api", "createStoryBlock failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "failed" };
  }
}

export async function updateStoryBlock(
  id: string,
  patch: { kind?: StoryKind; title?: string; content?: string; tags?: string[] },
): Promise<Result> {
  try {
    if (patch.kind && !STORY_KINDS.includes(patch.kind))
      return { ok: false, error: "Invalid kind." };
    const orgId = await callerOrgId();
    if (!orgId) return { ok: false, error: "Not signed in." };
    const sb = createClient();
    const { error } = await sb
      .from("story_blocks")
      .update(patch as never)
      .eq("id", id)
      .eq("org_id", orgId);
    if (error) throw error;
    revalidatePath("/dashboard/story-bank");
    return { ok: true };
  } catch (err) {
    logError("api", "updateStoryBlock failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "failed" };
  }
}

export async function deleteStoryBlock(id: string): Promise<Result> {
  try {
    const orgId = await callerOrgId();
    if (!orgId) return { ok: false, error: "Not signed in." };
    const sb = createClient();
    const { error } = await sb.from("story_blocks").delete().eq("id", id).eq("org_id", orgId);
    if (error) throw error;
    revalidatePath("/dashboard/story-bank");
    return { ok: true };
  } catch (err) {
    logError("api", "deleteStoryBlock failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "failed" };
  }
}
