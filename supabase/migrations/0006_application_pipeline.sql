-- Phase 2 WS2: application pipeline. Wire the dormant `applications` table into
-- a real tracker (identified → drafting → submitted → won/lost/declined),
-- persist the per-application checklist, and snapshot the grant deadline.
-- Additive + idempotent. RLS is already enforced via the Phase 1 applications_all
-- policy (is_org_member(org_id)); new columns inherit it.

-- One application per (org, grant) — makes "add to pipeline" an idempotent upsert.
create unique index if not exists applications_org_grant_key
  on applications(org_id, grant_id);

-- Lifecycle constraint (Phase 1 left status unconstrained).
alter table applications drop constraint if exists applications_status_check;
alter table applications add constraint applications_status_check
  check (status in ('identified','drafting','submitted','won','lost','declined'));

alter table applications add column if not exists deadline date;
alter table applications add column if not exists owner_user_id uuid
  references auth.users(id) on delete set null;
-- Persisted per-application checklist (replaces the throwaway useState in the UI).
alter table applications add column if not exists checklist jsonb not null default '{}'::jsonb;

create index if not exists applications_org_status_idx on applications(org_id, status);
