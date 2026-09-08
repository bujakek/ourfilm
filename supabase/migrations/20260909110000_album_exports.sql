-- Album exports: the state of a prepared ZIP, and the hand-offs around it.
--
-- Phase 2 of docs/public-cdn-and-export-worker.md. A large album is no longer
-- streamed through a Vercel function; it is a job. The host's page asks for
-- one, a worker on Railway claims it, builds the archive on its own disk and
-- uploads it to the private `event-exports` bucket, and Vercel marks it ready
-- and emails the host. This table is not the queue so much as the *record*:
-- what the host UI polls, the dedupe that stops two tabs starting two exports,
-- the lease that stops two workers building one, the row the sweep expires,
-- and the flag that remembers whether the email went out.
--
-- Supabase Queues (pgmq) was considered and not taken: it would replace the
-- claiming mechanics but not this table, and the worker reaches the database
-- only through Vercel anyway — there is no off-the-shelf role that can read
-- one queue and nothing else, and handing Railway the service key is exactly
-- what the design avoids. At one job type and a handful of exports per
-- wedding, `for update skip locked` on this table is the whole queue.
--
-- Access: RLS on with no policies, like `stripe_webhook_events`, and every
-- function revoked from `anon, authenticated` **by name** — `revoke … from
-- public` leaves Supabase's direct grants in place (see
-- 20260825080000_lock_down_capture_rpcs.sql). The host reaches this table only
-- through their own page, which checks ownership under RLS first and then
-- calls in with the service role; the worker reaches it only through Vercel's
-- endpoints behind a shared secret.

-- Both extensions come first: `album_export_cron_jobs` below is a SQL-language
-- function, and Postgres validates its body against `cron.job` at creation.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table public.album_exports (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.events (id) on delete cascade,
  status           text not null default 'queued'
                   check (status in ('queued', 'processing', 'ready', 'failed', 'expired')),
  -- Over more than the photo ids: `hidden_at`, `taken_at`, `created_at`, the
  -- uploader name and the event's zone all change the archive. A hide after an
  -- export must not serve the old ZIP.
  source_hash      text not null,
  photo_count      integer not null,
  -- The sum of the masters' sizes, so the worker can refuse a job its disk
  -- cannot hold before writing a byte.
  estimated_bytes  bigint not null default 0,
  -- Filled in at completion from what Storage reports, never from the worker.
  byte_size        bigint,
  storage_path     text,
  -- How many of the manifest's photos the worker could not fetch. The archive
  -- names them in a note; this is the number the host is told and the alert
  -- fires on.
  missing_count    integer not null default 0,
  -- Incremented at claim. Four claims is the budget; the retry policy and the
  -- lease sweep both read it.
  attempt_count    integer not null default 0,
  next_attempt_at  timestamptz,
  locked_at        timestamptz,
  locked_until     timestamptz,
  -- The resumable upload a worker created, reported through heartbeat, so a
  -- re-claimed job continues from the server's offset instead of starting
  -- the upload over. The file it uploads from is regenerated either way.
  tus_upload_url   text,
  notified_at      timestamptz,
  notify_attempts  integer not null default 0,
  last_error_code  text,
  created_at       timestamptz not null default now(),
  started_at       timestamptz,
  completed_at     timestamptz,
  expires_at       timestamptz
);

comment on table public.album_exports is
  'One prepared album archive per row. Service role only; see the migration.';

-- One job in flight per event. Two tabs, a double tap and a reloaded page all
-- land on the same row; `request_album_export` relies on this to be atomic.
create unique index album_exports_one_in_flight
  on public.album_exports (event_id)
  where status in ('queued', 'processing');

-- What the claimer scans: queued rows, oldest first.
create index album_exports_queue_idx
  on public.album_exports (created_at)
  where status = 'queued';

create index album_exports_event_idx
  on public.album_exports (event_id, created_at desc);

alter table public.album_exports enable row level security;
revoke all on table public.album_exports from anon, authenticated;
-- Tables created after the explicit-grants migration do not inherit the Data
-- API privileges reliably (see 20260901143100 for the same fix on
-- `stripe_checkout_attempts`); the service role needs them for the sweep's
-- reads and the tests' fixtures.
grant select, insert, update, delete on table public.album_exports to service_role;

-- ---------------------------------------------------------------------------
-- The host asks for an archive.
--
-- Serialised per event by locking the event row, so concurrent requests from
-- two tabs resolve to one answer. In order:
--   1. a job already queued or processing → that job;
--   2. a ready, unexpired archive built from the same `source_hash` → that
--      archive (the host downloads what already exists);
--   3. otherwise a fresh queued job.
-- A `failed` or `expired` latest row falls through to (3), which is how "Újra"
-- and "prepare it again" both work without a second code path.
create or replace function public.request_album_export(
  p_event_id        uuid,
  p_source_hash     text,
  p_photo_count     integer,
  p_estimated_bytes bigint
)
returns public.album_exports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.album_exports;
begin
  perform 1 from public.events e where e.id = p_event_id for update;
  if not found then
    raise exception 'No event %', p_event_id using errcode = 'no_data_found';
  end if;

  select * into v_row
  from public.album_exports x
  where x.event_id = p_event_id
    and x.status in ('queued', 'processing')
  limit 1;
  if found then
    return v_row;
  end if;

  select * into v_row
  from public.album_exports x
  where x.event_id = p_event_id
    and x.status = 'ready'
    and x.source_hash = p_source_hash
    and x.storage_path is not null
    and x.expires_at > now()
  order by x.completed_at desc
  limit 1;
  if found then
    return v_row;
  end if;

  insert into public.album_exports (event_id, source_hash, photo_count, estimated_bytes)
  values (p_event_id, p_source_hash, p_photo_count, p_estimated_bytes)
  returning * into v_row;
  return v_row;
end;
$$;

-- What the host's page shows: the job in flight if there is one, else the
-- newest row of any status, else nothing.
create or replace function public.album_export_status(p_event_id uuid)
returns public.album_exports
language sql
stable
security definer
set search_path = ''
as $$
  select *
  from public.album_exports x
  where x.event_id = p_event_id
  order by
    case when x.status in ('queued', 'processing') then 0 else 1 end,
    x.created_at desc
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- The worker asks for work.
--
-- One statement, one row, `skip locked` so two workers polling at once never
-- pick the same job and never wait on each other. The claim itself is the
-- attempt: `attempt_count` goes up here, and `started_at` is set once.
create or replace function public.claim_album_export(
  p_lease interval default interval '10 minutes'
)
returns public.album_exports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.album_exports;
begin
  update public.album_exports x
  set status        = 'processing',
      locked_at     = now(),
      locked_until  = now() + p_lease,
      started_at    = coalesce(x.started_at, now()),
      attempt_count = x.attempt_count + 1,
      next_attempt_at = null,
      last_error_code = null
  where x.id = (
    select c.id
    from public.album_exports c
    where c.status = 'queued'
      and (c.next_attempt_at is null or c.next_attempt_at <= now())
    order by c.created_at
    limit 1
    for update skip locked
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- A 2GB export outlives any sensible lease. Extends it, and records the
-- resumable upload if the worker has one. Returns false when the row is no
-- longer this worker's to work on — re-claimed after a lapsed lease, or gone
-- with a deleted event — so the worker stops rather than completing a job
-- somebody else now owns.
create or replace function public.heartbeat_album_export(
  p_id             uuid,
  p_lease          interval default interval '10 minutes',
  p_tus_upload_url text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.album_exports x
  set locked_until   = now() + p_lease,
      tus_upload_url = coalesce(p_tus_upload_url, x.tus_upload_url)
  where x.id = p_id
    and x.status = 'processing'
    and x.locked_until > now()
  returning x.id into v_id;

  return v_id is not null;
end;
$$;

-- Vercel marks the archive ready after reading the object back from Storage.
-- `p_byte_size` is what Storage reported, never what the worker said. Only a
-- job that is still this worker's — processing, lease live — can complete;
-- anything else raises, and the endpoint answers 409.
create or replace function public.complete_album_export(
  p_id            uuid,
  p_storage_path  text,
  p_byte_size     bigint,
  p_missing_count integer default 0
)
returns public.album_exports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.album_exports;
begin
  update public.album_exports x
  set status        = 'ready',
      storage_path  = p_storage_path,
      byte_size     = p_byte_size,
      missing_count = p_missing_count,
      completed_at  = now(),
      expires_at    = now() + interval '48 hours',
      locked_until  = null,
      tus_upload_url = null
  where x.id = p_id
    and x.status = 'processing'
    and x.locked_until > now()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Export % is not in progress', p_id using errcode = 'P0001';
  end if;
  return v_row;
end;
$$;

-- The worker gave up on this attempt. The server owns the budget: a transient
-- failure is queued again with a growing delay (30s, 2m, 10m); the fourth
-- claim's failure, or a permanent one, is final.
create or replace function public.fail_album_export(
  p_id    uuid,
  p_code  text,
  p_retry boolean
)
returns public.album_exports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.album_exports;
  v_delay interval;
begin
  select * into v_row from public.album_exports x where x.id = p_id for update;
  if v_row.id is null or v_row.status <> 'processing' then
    raise exception 'Export % is not in progress', p_id using errcode = 'P0001';
  end if;

  if p_retry and v_row.attempt_count < 4 then
    v_delay := case v_row.attempt_count
      when 1 then interval '30 seconds'
      when 2 then interval '2 minutes'
      else interval '10 minutes'
    end;
    update public.album_exports x
    set status          = 'queued',
        next_attempt_at = now() + v_delay,
        locked_until    = null,
        last_error_code = p_code
    where x.id = p_id
    returning * into v_row;
  else
    update public.album_exports x
    set status          = 'failed',
        locked_until    = null,
        last_error_code = p_code
    where x.id = p_id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- The pure-SQL half of the sweep, run by pg_cron every minute.
--
-- Two jobs that need no Storage call: an archive past its 48 hours stops being
-- `ready`, and a job whose worker died — lease lapsed, no heartbeat — goes
-- back to the queue, or to `failed` when its budget is spent. The second is
-- the same predicate the delete gate reads, which is the point: a container
-- that dies mid-export can block an event's deletion for one lease, never for
-- ever. Deleting the expired objects themselves, and retrying the email, need
-- the Storage API and Resend and live in `POST /api/exports/sweep`, which the
-- HTTP cron job below calls.
create or replace function public.sweep_album_exports()
returns table (expired integer, released integer, failed integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expired  integer;
  v_released integer;
  v_failed   integer;
begin
  update public.album_exports x
  set status = 'expired'
  where x.status = 'ready' and x.expires_at <= now();
  get diagnostics v_expired = row_count;

  update public.album_exports x
  set status          = 'queued',
      next_attempt_at = now(),
      locked_until    = null,
      last_error_code = 'lease_lost'
  where x.status = 'processing'
    and x.locked_until <= now()
    and x.attempt_count < 4;
  get diagnostics v_released = row_count;

  update public.album_exports x
  set status          = 'failed',
      locked_until    = null,
      last_error_code = 'lease_lost'
  where x.status = 'processing'
    and x.locked_until <= now()
    and x.attempt_count >= 4;
  get diagnostics v_failed = row_count;

  return query select v_expired, v_released, v_failed;
end;
$$;

-- Which cron jobs this migration installed, readable through PostgREST so the
-- database suite can assert the schedule exists after a reset. The `cron`
-- schema itself is not exposed.
create or replace function public.album_export_cron_jobs()
returns table (jobname text, schedule text, active boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select j.jobname::text, j.schedule::text, j.active
  from cron.job j
  where j.jobname like 'album-exports-%'
  order by j.jobname
$$;

-- ---------------------------------------------------------------------------
-- Lock every function down to the service role. By name, not via PUBLIC.
revoke all on function public.request_album_export(uuid, text, integer, bigint)
  from public, anon, authenticated;
revoke all on function public.album_export_status(uuid)
  from public, anon, authenticated;
revoke all on function public.claim_album_export(interval)
  from public, anon, authenticated;
revoke all on function public.heartbeat_album_export(uuid, interval, text)
  from public, anon, authenticated;
revoke all on function public.complete_album_export(uuid, text, bigint, integer)
  from public, anon, authenticated;
revoke all on function public.fail_album_export(uuid, text, boolean)
  from public, anon, authenticated;
revoke all on function public.sweep_album_exports()
  from public, anon, authenticated;
revoke all on function public.album_export_cron_jobs()
  from public, anon, authenticated;

grant execute on function public.request_album_export(uuid, text, integer, bigint) to service_role;
grant execute on function public.album_export_status(uuid) to service_role;
grant execute on function public.claim_album_export(interval) to service_role;
grant execute on function public.heartbeat_album_export(uuid, interval, text) to service_role;
grant execute on function public.complete_album_export(uuid, text, bigint, integer) to service_role;
grant execute on function public.fail_album_export(uuid, text, boolean) to service_role;
grant execute on function public.sweep_album_exports() to service_role;
grant execute on function public.album_export_cron_jobs() to service_role;

-- ---------------------------------------------------------------------------
-- pg_cron is the clock.
--
-- Not a Vercel Cron: on Hobby that runs once a day with an hour of slop, and a
-- once-daily retry is not a delivery policy for the most important email the
-- product sends. Not the worker either: the one failure that kills an export
-- — a dead container — would also silence the retry of the email about it.
-- The schedule lives here so it is versioned like everything else and comes
-- back on every `db reset`.
--
-- The HTTP job reads its target and secret from Vault, never from a literal
-- in a migration. Where the two secrets are absent — every local stack, every
-- CI run — it posts nothing, so the schedule installs everywhere and only the
-- hosted project actually calls out. To arm it:
--
--   select vault.create_secret('https://ourfilm.app', 'ourfilm_api_url');
--   select vault.create_secret('<EXPORT_WORKER_SECRET>', 'export_worker_secret');
--
-- pg_net is fire-and-forget — the response lands in `net._http_response` and
-- nothing reads it — so the endpoint reports its own outcome to PostHog as
-- `album_export_sweep`, and a schedule with no such event for an hour is the
-- alert.
select cron.schedule(
  'album-exports-sweep-sql',
  '* * * * *',
  $$ select public.sweep_album_exports() $$
);

select cron.schedule(
  'album-exports-sweep-http',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := s.api_url || '/api/exports/sweep',
    headers := jsonb_build_object(
      'authorization', 'Bearer ' || s.secret,
      'content-type',  'application/json'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  from (
    select
      (select decrypted_secret from vault.decrypted_secrets where name = 'ourfilm_api_url' limit 1)      as api_url,
      (select decrypted_secret from vault.decrypted_secrets where name = 'export_worker_secret' limit 1) as secret
  ) s
  where s.api_url is not null and s.secret is not null
  $$
);
