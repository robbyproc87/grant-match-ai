# GrantMatch AI — Phase 1

## Project Overview
A grant-discovery and writing assistant for nonprofits, focused on Jazmine&rsquo;s Journey as the launch tenant but multi-tenant from day one. Phase 1 ships an org profile, ProPublica-backed funders, hand-curated open grants, server-computed match scores, and streaming Claude chat.

## Stack
- Next.js 14 App Router, React Server Components, Server Actions
- TypeScript (strict)
- Supabase (Postgres + Auth + Storage, `pgvector` enabled)
- shadcn/ui (new-york), Tailwind CSS, Inter via `next/font/google`
- Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) — `claude-sonnet-4-6` chat, `claude-haiku-4-5-20251001` utility

## Running locally
- `npm run dev` — Next dev on port 5000 (workflow: `Start application`)
- `npm run migrate` — apply Supabase migrations (requires `SUPABASE_DB_URL`)
- `npm run seed` — seed funders (ProPublica) + grants (curated)

## Required environment variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_SITE_URL`

## Architecture notes
- **Multi-tenant**: every org-data table joins through `org_members` for RLS.
- **Scoring**: 6 factors (mission 30 + geo 15 + budget 15 + eligibility 15 + population 15 + prior 10 = 100). Deterministic factors are pure TS; mission + population batched into one Haiku JSON call. Runner upserts `match_scores` rows with status lifecycle `pending → computing → computed | failed`.
- **Onboarding**: 3 steps (`/onboarding/basics`, `/mission`, `/history`). Final step fire-and-forgets `recomputeScoresForOrg` and redirects to `/dashboard/grants`, where the client polls `match_scores` every 2s until terminal.
- **Chat**: streamed via Vercel AI SDK; system prompt = org-level context only (Phase 1).
- **Eligibility**: locked Zod schema in `lib/types/eligibility.ts`. `custom_rules` are NEVER auto-evaluated — surfaced as a manual checkbox checklist.
- **Models**: pinned in `lib/anthropic/models.ts` — never substitute.

## Deployment
- `output: 'standalone'` in `next.config.mjs`.
- Production run command: `next start -p $PORT -H 0.0.0.0`.
- Health: `/api/health`.

## Out of scope (Phase 1)
Pipeline/Kanban, Claude narrative shell drafting, story bank, document vault, email/CRM, reporting calendar, tool use, Stripe, analytics, Sentry, i18n, landing page.

## Phase 2 deferred items (informal — promote to project tasks at Phase 2 kickoff)
- Replace token-overlap heuristic in `scripts/seed-funders.ts` with a relevance-score-based confidence threshold (token-overlap false-positived on Conquer Cancer Foundation matching "Positive Actions To Conquer Cancer Foundation Corp"; ProPublica's `score` field is the better signal).
- Move ProPublica query normalizer into `lib/sources/propublica.ts` (parens, `+`, special chars). Today the sanitization lives in `scripts/seed-funders.ts`; it should live in the adapter so all callers benefit.
- Add a Candid/GuideStar source adapter to recover funders not in ProPublica (currently dropped from seed: Rally Foundation for Childhood Cancer Research, The Steele Foundation (AZ); also Pediatric AIDS Foundation, Starlight Children's Foundation, Children's Miracle Network Hospitals — orphan grants for these were removed).
