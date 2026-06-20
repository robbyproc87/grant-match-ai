-- Phase 2 Milestone C: the "win engine".
-- - story_blocks: reusable evidence (impact stats, testimonials, program
--   descriptions, narrative snippets) the AI grounds drafts in.
-- - application_drafts: AI-generated, human-editable narrative sections per
--   application, plus a persisted "funder's-eye" review.
-- - applications outcome columns (WS3): amount + decision date, the substrate
--   for the Phase 3 win-probability model.
-- Additive + idempotent. RLS org-scoped, mirroring the Phase 1 pattern.

create table if not exists story_blocks (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  kind text not null default 'narrative'
    check (kind in ('impact_stat','testimonial','program','narrative','other')),
  title text not null,
  content text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists story_blocks_org_idx on story_blocks(org_id);

create table if not exists application_drafts (
  application_id uuid primary key references applications(id) on delete cascade,
  org_id uuid not null references orgs(id) on delete cascade,
  -- { need_statement, goals, approach, budget_narrative, sustainability }
  sections jsonb not null default '{}'::jsonb,
  -- funder's-eye review: { summary, suggestions: [{section, issue, fix}] }
  review jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists application_drafts_org_idx on application_drafts(org_id);

-- WS3 outcome capture (status already carries won/lost/declined).
alter table applications add column if not exists outcome_amount numeric;
alter table applications add column if not exists decided_at timestamptz;

-- RLS
alter table story_blocks enable row level security;
alter table application_drafts enable row level security;

drop policy if exists story_blocks_all on story_blocks;
create policy story_blocks_all on story_blocks for all using (is_org_member(org_id))
  with check (is_org_member(org_id));

drop policy if exists application_drafts_all on application_drafts;
create policy application_drafts_all on application_drafts for all using (is_org_member(org_id))
  with check (is_org_member(org_id));

-- updated_at triggers
drop trigger if exists trg_story_blocks_updated on story_blocks;
create trigger trg_story_blocks_updated before update on story_blocks
  for each row execute procedure set_updated_at();

drop trigger if exists trg_application_drafts_updated on application_drafts;
create trigger trg_application_drafts_updated before update on application_drafts
  for each row execute procedure set_updated_at();
