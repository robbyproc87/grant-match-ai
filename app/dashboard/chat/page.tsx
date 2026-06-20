import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgProfile, getCurrentUser } from "@/lib/supabase/queries";
import { ChatClient } from "./chat-client";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: { grantId?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const profile = await getCurrentOrgProfile(user.id);
  if (!profile) redirect("/onboarding/basics");

  const supabase = createClient();
  const { data } = (await supabase
    .from("messages")
    .select("id, role, content")
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: true })
    .limit(50)) as {
    data: Array<{ id: string; role: "user" | "assistant"; content: string }> | null;
  };

  const initialMessages = (data ?? []).map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
  }));

  // Optional grant focus passed via ?grantId= (deep-link from a grant card).
  const grantId = searchParams?.grantId;
  let grantName: string | null = null;
  if (grantId) {
    const { data: g } = (await supabase
      .from("grants")
      .select("name")
      .eq("id", grantId)
      .maybeSingle()) as { data: { name: string } | null };
    grantName = g?.name ?? null;
  }

  return (
    <ChatClient
      orgId={profile.org_id}
      initialMessages={initialMessages}
      grantId={grantName ? grantId : undefined}
      grantName={grantName}
    />
  );
}
