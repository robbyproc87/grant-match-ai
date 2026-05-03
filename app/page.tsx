import { redirect } from "next/navigation";
import {
  getCurrentUser,
  getCurrentOrgId,
  isOnboardingComplete,
} from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const orgId = await getCurrentOrgId(user.id);
  if (!orgId || !(await isOnboardingComplete(orgId))) {
    redirect("/onboarding/basics");
  }
  redirect("/dashboard/grants");
}
