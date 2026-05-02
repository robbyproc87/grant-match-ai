# GrantMatch AI

Phase 1 foundation — a Next.js 14 grant-discovery and writing assistant for nonprofits, built on Supabase + Claude.

## Stack
- **Next.js 14** App Router + React Server Components + Server Actions
- **TypeScript** (strict)
- **Supabase** (Postgres + Auth magic-link + Storage + RLS, `pgvector` enabled for Phase 2)
- **shadcn/ui** (new-york) + Tailwind CSS + Inter via `next/font/google`
- **Vercel AI SDK** (`ai` + `@ai-sdk/anthropic`) — `claude-sonnet-4-6` for chat, `claude-haiku-4-5-20251001` for utility scoring

## Architecture (one paragraph)
Each user belongs to an `org` (multi-tenant from day one). Onboarding writes `orgs`, `org_members`, and `org_profiles`, then fire-and-forgets a Server Action that scores every seeded grant against the org's profile in the background. Match scoring composes six factors (mission, geographic, budget, eligibility, population, prior relationship) — deterministic factors run pure-TS, while mission + population are batched into one Haiku JSON call per grant. The client polls `match_scores` until all rows reach a terminal status. Streaming chat is handled by the Vercel AI SDK with org-level context only; messages persist in the `messages` table. Every table has RLS scoped through `org_members`.

## Setup order
1. **Create a Supabase project** — copy the project URL, anon key, service-role key, and database connection string.
2. Set the following environment variables (use Replit Secrets):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_DB_URL` (postgres connection string for migrations + seeds)
   - `ANTHROPIC_API_KEY`
   - `NEXT_PUBLIC_SITE_URL` (e.g. your Replit dev URL)
3. Apply schema: `npm run migrate` (creates tables, enables `pgvector`, installs RLS policies)
4. Seed data: `npm run seed` (funders from ProPublica → grants from curated list)
5. Run dev: `npm run dev` (port 5000)

### Supabase project settings (one-time, in the Supabase dashboard)
These live in the Supabase web console — they are not in code:
- **Auth → Email Templates → Magic Link**: replace the default "Supabase Auth"
  sender name with "GrantMatch AI" and update the from-address / template copy
  to match the product voice.
- **Auth → URL Configuration**: add `${NEXT_PUBLIC_SITE_URL}/auth/callback` to
  the redirect allow-list (and your production domain when you deploy).
- **Auth → Sessions**: set the JWT/refresh-token lifetime to 30 days so users
  stay signed in across visits without re-requesting a magic link.

## Scripts
- `npm run dev` — Next dev server on port 5000
- `npm run build` / `npm run start` — production build / start (uses `$PORT`)
- `npm run lint` / `npm run typecheck`
- `npm run test` — Vitest suite (scoring engine)
- `npm run migrate` — apply SQL migrations to Supabase
- `npm run seed` — runs `seed-funders` then `seed-grants`

## File tree (top-level)
```
app/                  # Next.js App Router
  api/chat/           # streaming chat (Vercel AI SDK)
  api/health/         # health check
  auth/callback/      # magic-link exchange
  sign-in/            # email magic-link
  onboarding/         # 3-step wizard (basics, mission, history)
  dashboard/          # grants, checklist, shell, chat
components/           # shadcn primitives + custom (FitBadge, GradientHeader…)
lib/
  anthropic/          # pinned model IDs
  scoring/            # 6-factor engine + runner + Server Action
  sources/            # SourceAdapter + ProPublica implementation
  supabase/           # browser/server/admin/middleware clients
  types/              # eligibility Zod schema + DB types
scripts/              # migrate + seed (funders, grants)
supabase/migrations/  # 0001_init.sql, 0002_rls.sql
tests/                # Vitest scoring tests
```

## Phase 2 roadmap
Pipeline/Kanban view, Claude-driven narrative shell drafting, story bank, document vault, email/CRM integrations, reporting calendar, tool use in chat, Stripe billing, analytics.
