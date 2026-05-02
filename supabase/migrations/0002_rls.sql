-- Row-level security policies
alter table orgs enable row level security;
alter table org_members enable row level security;
alter table org_profiles enable row level security;
alter table programs enable row level security;
alter table funders enable row level security;
alter table grants enable row level security;
alter table applications enable row level security;
alter table match_scores enable row level security;
alter table messages enable row level security;

-- Helper: is the calling user a member of this org?
create or replace function is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from org_members
    where org_id = target_org and user_id = auth.uid()
  );
$$;

-- ORGS: members can read; only authenticated users can insert (during onboarding).
drop policy if exists orgs_select on orgs;
create policy orgs_select on orgs for select using (is_org_member(id));
drop policy if exists orgs_insert on orgs;
create policy orgs_insert on orgs for insert with check (auth.uid() is not null);

-- ORG_MEMBERS: members can read their own rows; insert allowed during onboarding for self.
drop policy if exists org_members_select on org_members;
create policy org_members_select on org_members for select using (user_id = auth.uid());
drop policy if exists org_members_insert on org_members;
create policy org_members_insert on org_members for insert with check (user_id = auth.uid());

-- ORG_PROFILES: scoped to org members.
drop policy if exists org_profiles_select on org_profiles;
create policy org_profiles_select on org_profiles for select using (is_org_member(org_id));
drop policy if exists org_profiles_modify on org_profiles;
create policy org_profiles_modify on org_profiles for all using (is_org_member(org_id))
  with check (is_org_member(org_id));

-- PROGRAMS
drop policy if exists programs_all on programs;
create policy programs_all on programs for all using (is_org_member(org_id))
  with check (is_org_member(org_id));

-- FUNDERS / GRANTS: readable by every authenticated user.
drop policy if exists funders_read on funders;
create policy funders_read on funders for select using (auth.uid() is not null);
drop policy if exists grants_read on grants;
create policy grants_read on grants for select using (auth.uid() is not null);

-- APPLICATIONS / MATCH_SCORES / MESSAGES — org-scoped.
drop policy if exists applications_all on applications;
create policy applications_all on applications for all using (is_org_member(org_id))
  with check (is_org_member(org_id));

drop policy if exists match_scores_read on match_scores;
create policy match_scores_read on match_scores for select using (is_org_member(org_id));

drop policy if exists messages_all on messages;
create policy messages_all on messages for all using (is_org_member(org_id))
  with check (is_org_member(org_id));
