-- GrantMatch AI — initial schema
create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- ORGS ---------------------------------------------------------
create table if not exists orgs (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists org_members (
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists org_members_user_id_idx on org_members(user_id);

create table if not exists org_profiles (
  org_id uuid primary key references orgs(id) on delete cascade,
  ein text,
  org_name text not null,
  org_type text not null default 'nonprofit'
    check (org_type in ('nonprofit','school','government','tribal')),
  has_501c3 boolean not null default false,
  years_operating int not null default 0,
  annual_budget numeric not null default 0,
  mission text not null default '',
  focus_areas text[] not null default '{}',
  populations_served text[] not null default '{}',
  geographies text[] not null default '{}',
  past_grants jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists programs (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);
create index if not exists programs_org_id_idx on programs(org_id);

-- FUNDERS / GRANTS (global, readable by all authenticated) -----
create table if not exists funders (
  id uuid primary key default uuid_generate_v4(),
  ein text unique not null,
  name text not null,
  description text,
  focus_areas text[] not null default '{}',
  geographies text[] not null default '{}',
  total_assets numeric,
  source text not null default 'propublica',
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists grants (
  id uuid primary key default uuid_generate_v4(),
  funder_id uuid not null references funders(id) on delete cascade,
  name text not null,
  description text,
  amount_min numeric,
  amount_max numeric,
  deadline date,
  deadline_type text not null default 'fixed'
    check (deadline_type in ('fixed','rolling','loi_then_full')),
  eligibility jsonb not null default '{}'::jsonb,
  focus_areas text[] not null default '{}',
  geographies text[] not null default '{}',
  source text not null default 'manual',
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (funder_id, name)
);

create table if not exists applications (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  grant_id uuid not null references grants(id) on delete cascade,
  status text not null default 'identified',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists applications_org_id_idx on applications(org_id);

-- MATCH SCORES -------------------------------------------------
create table if not exists match_scores (
  org_id uuid not null references orgs(id) on delete cascade,
  grant_id uuid not null references grants(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','computing','computed','failed')),
  score_total int,
  score_breakdown jsonb,
  error_message text,
  computed_at timestamptz,
  primary key (org_id, grant_id)
);
create index if not exists match_scores_org_status_idx on match_scores(org_id, status);

-- MESSAGES (chat history) --------------------------------------
create table if not exists messages (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_org_id_created_idx on messages(org_id, created_at);

-- updated_at trigger ------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_org_profiles_updated on org_profiles;
create trigger trg_org_profiles_updated before update on org_profiles
  for each row execute procedure set_updated_at();

drop trigger if exists trg_funders_updated on funders;
create trigger trg_funders_updated before update on funders
  for each row execute procedure set_updated_at();

drop trigger if exists trg_grants_updated on grants;
create trigger trg_grants_updated before update on grants
  for each row execute procedure set_updated_at();

drop trigger if exists trg_applications_updated on applications;
create trigger trg_applications_updated before update on applications
  for each row execute procedure set_updated_at();
