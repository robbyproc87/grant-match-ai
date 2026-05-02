import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentOrgProfile } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const profile = await getCurrentOrgProfile(user.id);
  if (!profile) redirect("/onboarding/basics");
  redirect("/dashboard/grants");
}
