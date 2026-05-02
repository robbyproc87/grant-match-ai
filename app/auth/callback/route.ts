import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_code`);
  }
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      logError("auth", "exchange failed", error);
      return NextResponse.redirect(`${origin}/sign-in?error=exchange`);
    }
    return NextResponse.redirect(`${origin}${next}`);
  } catch (err) {
    logError("auth", "callback exception", err);
    return NextResponse.redirect(`${origin}/sign-in?error=callback`);
  }
}
