-- Phase 1: explicit onboarding completion marker.
-- Set ONLY by saveHistoryAndFinish (step 3). All redirect guards
-- (app/page.tsx, /dashboard/layout.tsx, /onboarding/layout.tsx) treat a NULL
-- value as "still in onboarding" so partial profiles never bypass step 2/3.
alter table org_profiles
  add column if not exists onboarding_completed_at timestamptz;
