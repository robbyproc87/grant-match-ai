-- Phase 2: enable ingestion from opportunity-centric sources (e.g. Grants.gov)
-- that have no EIN and are keyed by a source-native id. Additive + idempotent;
-- safe to run against existing Phase 1 data.

-- FUNDERS: allow non-EIN sources, add a stable source id for idempotent upsert.
-- (Federal agencies have no EIN; the Phase 1 `ein text unique not null` blocked them.)
alter table funders alter column ein drop not null;
alter table funders add column if not exists source_id text;

-- Keep EIN unique only when present. The Phase 1 schema declared `ein text
-- unique`, which created a CONSTRAINT (funders_ein_key) — drop the constraint
-- (not the index it owns) and replace with a partial unique index that permits
-- NULL eins for non-EIN sources.
alter table funders drop constraint if exists funders_ein_key;
create unique index if not exists funders_ein_unique
  on funders(ein) where ein is not null;
-- NON-partial on (source, source_id): PostgREST upsert issues a bare
-- ON CONFLICT (source, source_id) with no predicate, so it cannot match a
-- partial index (error 42P10). A plain unique index works because Postgres
-- treats NULL source_id (curated/ProPublica rows) as distinct — no collision.
drop index if exists funders_source_source_id_key;
create unique index funders_source_source_id_key
  on funders(source, source_id);

-- GRANTS: add a stable source id so re-ingestion dedupes instead of duplicating.
-- The Phase 1 unique(funder_id, name) constraint stays for curated/manual rows.
alter table grants add column if not exists source_id text;
drop index if exists grants_source_source_id_key;
create unique index grants_source_source_id_key
  on grants(source, source_id);
