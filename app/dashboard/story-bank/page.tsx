import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgProfile, getCurrentUser } from "@/lib/supabase/queries";
import { StoryBankClient } from "./story-bank-client";
import type { StoryBlock } from "@/lib/types/db";

export const dynamic = "force-dynamic";

export default async function StoryBankPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const profile = await getCurrentOrgProfile(user.id);
  if (!profile) redirect("/onboarding/basics");

  const supabase = createClient();

  const { data } = await supabase
    .from("story_blocks")
    .select("*")
    .eq("org_id", profile.org_id)
    .order("updated_at", { ascending: false });

  const blocks = (data ?? []) as StoryBlock[];

  return <StoryBankClient initialBlocks={blocks} />;
}
