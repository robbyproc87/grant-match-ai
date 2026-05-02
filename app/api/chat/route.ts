import { streamText, type CoreMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { CHAT_MODEL } from "@/lib/anthropic/models";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgProfile, getCurrentUser } from "@/lib/supabase/queries";
import { logError, log } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return new Response("Unauthorized", { status: 401 });
    const profile = await getCurrentOrgProfile(user.id);
    if (!profile)
      return new Response("Complete onboarding first", { status: 400 });

    const body = (await req.json()) as {
      messages: CoreMessage[];
      orgId?: string;
    };
    const messages = body.messages ?? [];
    if (body.orgId && body.orgId !== profile.org_id) {
      return new Response("Org mismatch", { status: 403 });
    }

    const system = buildSystemPrompt(profile);
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const userText =
      lastUser && typeof lastUser.content === "string" ? lastUser.content : "";

    const result = await streamText({
      model: anthropic(CHAT_MODEL),
      system,
      messages,
      maxTokens: 1500,
      onFinish: async ({ text }) => {
        try {
          const sb = createClient();
          const rows: Array<Record<string, unknown>> = [];
          if (userText.trim()) {
            rows.push({
              org_id: profile.org_id,
              user_id: user.id,
              role: "user",
              content: userText,
            });
          }
          if (text.trim()) {
            rows.push({
              org_id: profile.org_id,
              user_id: user.id,
              role: "assistant",
              content: text,
            });
          }
          if (rows.length > 0) {
            await (sb.from("messages") as ReturnType<typeof sb.from>).insert(
              rows as never,
            );
          }
        } catch (err) {
          logError("chat", "persist messages failed", err);
        }
      },
    });

    log("chat", "stream started", { orgId: profile.org_id });
    return result.toDataStreamResponse();
  } catch (err) {
    logError("chat", "route exception", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "chat failed",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

function buildSystemPrompt(profile: {
  org_name: string;
  mission: string;
  focus_areas: string[];
  annual_budget: number;
  populations_served: string[];
}): string {
  return `You are a senior grant writing strategist embedded inside GrantMatch AI.
You help one specific nonprofit win grants — be concrete, specific, and actionable.

ABOUT THE ORG
- Name: ${profile.org_name}
- Mission: ${profile.mission || "(not provided)"}
- Focus areas: ${(profile.focus_areas ?? []).join(", ") || "(not provided)"}
- Populations served: ${(profile.populations_served ?? []).join(", ") || "(not provided)"}
- Annual budget: $${(profile.annual_budget ?? 0).toLocaleString()}

GUIDELINES
- Be direct. Skip preambles like "Great question!"
- When giving narrative examples, write in a tone the org could ship.
- Always tie advice back to this org's mission and capacity — never give generic boilerplate.
- If asked about a specific grant, ask for the funder name if not provided.
- Cite reasoning briefly. Use lists when there are 3+ steps.`;
}
