-- Phase 2 WS6: durable scoring queue.
-- Phase 1 drained match_scores via in-process fire-and-forget — fully serial
-- and lost on a Replit restart (rows stranded in 'computing'). This makes the
-- match_scores table itself the durable queue: a scheduled drainer atomically
-- claims work, processes it with bounded concurrency, and can recover rows
-- stranded by a crash. Additive + idempotent.

alter table match_scores add column if not exists claimed_at timestamptz;

create index if not exists match_scores_claimable_idx
  on match_scores(status, claimed_at);

-- Atomically claim up to `batch` rows that are queued ('pending') OR stale
-- ('computing' but claimed longer ago than `claim_ttl`). Sets them to
-- 'computing', stamps claimed_at, and returns them. FOR UPDATE SKIP LOCKED
-- makes concurrent drainers safe — no row is ever handed out twice.
create or replace function claim_scoring_jobs(
  batch int,
  claim_ttl interval default interval '5 minutes'
)
returns table (claimed_org_id uuid, claimed_grant_id uuid)
language plpgsql
as $$
begin
  return query
  update match_scores ms
     set status = 'computing',
         claimed_at = now()
   where (ms.org_id, ms.grant_id) in (
     select c.org_id, c.grant_id
       from match_scores c
      where c.status = 'pending'
         or (c.status = 'computing' and c.claimed_at < now() - claim_ttl)
      order by c.claimed_at nulls first
      limit batch
      for update skip locked
   )
  returning ms.org_id, ms.grant_id;
end;
$$;
