"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/browser";
import { toast } from "sonner";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.match(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)) {
      toast.error("Enter a valid email.");
      return;
    }
    setPending(true);
    try {
      const supabase = createClient();
      const origin =
        process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${origin}/auth/callback` },
      });
      if (error) {
        toast.error(error.message);
      } else {
        setSent(true);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gm-gradient p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-2xl">🌈</span>
            <span className="text-sm font-semibold tracking-wide text-muted-foreground">
              GrantMatch AI
            </span>
          </div>
          <CardTitle>Sign in to your workspace</CardTitle>
          <CardDescription>
            We&rsquo;ll email you a magic link — no password required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="rounded-lg border border-gm-purple100 bg-gm-purple50 p-4 text-sm">
              Check <strong>{email}</strong> for a link to sign in.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@yournonprofit.org"
                />
              </div>
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Sending…" : "Send magic link"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
