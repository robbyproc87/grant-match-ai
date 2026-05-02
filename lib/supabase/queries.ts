import { createClient } from "./server";
import type { OrgProfile } from "@/lib/types/db";

export async function getCurrentUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export type CurrentOrgProfile = OrgProfile & { org_id: string };

export async function getCurrentOrgProfile(
  userId: string,
): Promise<CurrentOrgProfile | null> {
  const supabase = createClient();
  const { data: member } = (await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle()) as { data: { org_id: string } | null };
  if (!member?.org_id) return null;
  const { data: profile } = (await supabase
    .from("org_profiles")
    .select("*")
    .eq("org_id", member.org_id)
    .maybeSingle()) as { data: OrgProfile | null };
  if (!profile) return null;
  return { ...profile, org_id: member.org_id };
}

export async function getCurrentOrgId(userId: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = (await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle()) as { data: { org_id: string } | null };
  return data?.org_id ?? null;
}
