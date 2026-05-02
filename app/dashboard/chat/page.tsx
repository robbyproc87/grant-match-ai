import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgProfile, getCurrentUser } from "@/lib/supabase/queries";
import { ChatClient } from "./chat-client";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
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

  return <ChatClient orgId={profile.org_id} initialMessages={initialMessages} />;
}
