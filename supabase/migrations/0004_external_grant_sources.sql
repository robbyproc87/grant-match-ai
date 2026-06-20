-- Phase 2: enable ingestion from opportunity-centric sources (e.g. Grants.gov)
-- that have no EIN and are keyed by a source-native id. Additive + idempotent;
-- safe to run against existing Phase 1 data.

-- FUNDERS: allow non-EIN sources, add a stable source id for idempotent upsert.
-- (Federal agencies have no EIN; the Phase 1 `ein text unique not null` blocked them.)
alter table funders alter column ein drop not null;
alter table funders add column if not exists source_id text;

-- Keep EIN unique only when present (Postgres allows multiple NULLs in a plain
-- unique index, but make the intent explicit with a partial index).
drop index if exists funders_ein_key;
create unique index if not exists funders_ein_unique
  on funders(ein) where ein is not null;
create unique index if not exists funders_source_source_id_key
  on funders(source, source_id) where source_id is not null;

-- GRANTS: add a stable source id so re-ingestion dedupes instead of duplicating.
-- The Phase 1 unique(funder_id, name) constraint stays for curated/manual rows.
alter table grants add column if not exists source_id text;
create unique index if not exists grants_source_source_id_key
  on grants(source, source_id) where source_id is not null;
