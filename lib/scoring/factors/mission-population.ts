import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { UTILITY_MODEL } from "@/lib/anthropic/models";
import { logError } from "@/lib/logger";
import { z } from "zod";

const HaikuResponseSchema = z.object({
  mission: z.object({
    score: z.number().int().min(0).max(30),
    reasoning: z.string(),
  }),
  population: z.object({
    score: z.number().int().min(0).max(15),
    reasoning: z.string(),
  }),
});

export type MissionPopulationInput = {
  orgName: string;
  orgMission: string;
  orgFocusAreas: string[];
  orgPopulationsServed: string[];
  grantName: string;
  grantDescription: string | null;
  grantFocusAreas: string[];
  funderName: string;
};

export type MissionPopulationResult = {
  mission: { score: number; reasoning: string };
  population: { score: number; reasoning: string };
};

const SYSTEM_PROMPT = `You are an expert grant strategist evaluating fit between a nonprofit and a grant opportunity.
Return ONLY a single JSON object — no prose, no markdown, no code fences.
Schema:
{
  "mission": {"score": <integer 0-30>, "reasoning": "<one sentence>"},
  "population": {"score": <integer 0-15>, "reasoning": "<one sentence>"}
}
Score 0 = no alignment; mission max 30 = direct mission match; population max 15 = exact population overlap.`;

function buildUserPrompt(i: MissionPopulationInput): string {
  return `Org: ${i.orgName}
Mission: ${i.orgMission}
Focus areas: ${i.orgFocusAreas.join(", ") || "(none)"}
Populations served: ${i.orgPopulationsServed.join(", ") || "(none)"}

Grant: ${i.grantName} (${i.funderName})
Description: ${i.grantDescription ?? "(none)"}
Focus areas: ${i.grantFocusAreas.join(", ") || "(none)"}

Score mission_alignment (0-30) and population_alignment (0-15). Return JSON only.`;
}

function extractJson(text: string): unknown {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fence ? fence[1] : text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in response");
  return JSON.parse(raw.slice(start, end + 1));
}

export async function scoreMissionAndPopulation(
  input: MissionPopulationInput,
): Promise<MissionPopulationResult> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { text } = await generateText({
        model: anthropic(UTILITY_MODEL),
        system: SYSTEM_PROMPT,
        prompt: buildUserPrompt(input),
        maxTokens: 400,
      });
      const parsed = HaikuResponseSchema.parse(extractJson(text));
      return parsed;
    } catch (err) {
      lastErr = err;
      logError("scoring", `mission/population attempt ${attempt + 1} failed`, err);
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("mission/population scoring failed");
}
