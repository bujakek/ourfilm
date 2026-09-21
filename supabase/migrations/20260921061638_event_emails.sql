-- Host lifecycle mail. Private outbox: no browser can enumerate recipients,
-- claim deliveries or mark a notification sent.
create table public.event_emails (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  kind text not null check (kind in ('upcoming', 'ended')),
  capture_end_at timestamptz not null,
  scheduled_at timestamptz not null,
  snapshot jsonb not null,
  payload jsonb,
  created_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  attempts integer not null default 0,
  sent_at timestamptz,
  -- Keyed on the schedule, not just the kind. A host who moves their end date
  -- gets a mail for the new schedule; the old row stays as history. Keying on
  -- (event_id, kind) alone meant a reminder sent for a since-abandoned date
  -- was the only one that event would ever get — and moving the end forwards
  -- is how a host reopens a closed camera, so that is an ordinary flow.
  unique (event_id, kind, scheduled_at)
);
alter table public.event_emails enable row level security;
revoke all on public.event_emails from anon, authenticated;
grant all on public.event_emails to service_role;
create index event_emails_pending_idx on public.event_emails(next_attempt_at)
  where sent_at is null;

-- Calendar arithmetic happens BEFORE converting back to UTC, including DST.
create function public.event_email_due_at(p_end timestamptz, p_zone text, p_kind text)
returns timestamptz language sql stable security invoker set search_path = ''
as $$
  select case p_kind
    when 'upcoming' then (((p_end at time zone p_zone)::date - 2) + time '10:00') at time zone p_zone
    when 'ended' then (((p_end at time zone p_zone)::date + 1) + time '09:00') at time zone p_zone
  end
$$;
revoke all on function public.event_email_due_at(timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.event_email_due_at(timestamptz, text, text) to service_role;

-- Claim one at a time, so a bounded HTTP run never leases more than it sends.
-- The snapshot and later the exact provider payload survive every retry.
create function public.claim_event_email()
returns setof public.event_emails
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.event_emails(event_id, kind, capture_end_at, scheduled_at, snapshot)
  select e.id, k.kind, e.capture_end_at, d.due_at,
    jsonb_build_object(
      'locale', e.locale, 'eventName', e.event_name, 'slug', e.slug,
      'recipient', u.email,
      'photoCount', (select count(*) from public.photos p where p.event_id = e.id and p.status = 'ready' and p.deleted_at is null)
    )
  from public.events e
  join auth.users u on u.id = e.owner_id
  cross join (values ('upcoming'), ('ended')) k(kind)
  cross join lateral (select public.event_email_due_at(e.capture_end_at, e.time_zone, k.kind) as due_at) d
  where u.email is not null and u.deleted_at is null
    -- No historical mail burst when enabled, or reminder for a last-minute event.
    and d.due_at <= now() and d.due_at > now() - interval '12 hours'
    and e.created_at <= d.due_at
    and (k.kind <> 'upcoming' or e.capture_end_at > now())
    -- Per schedule: a rescheduled event queues again for its new due date,
    -- and only the 12-hour window above bounds how often that can happen.
    and not exists (
      select 1 from public.event_emails m
      where m.event_id = e.id and m.kind = k.kind and m.scheduled_at = d.due_at
    )
  order by d.due_at, e.id
  limit 20
  on conflict (event_id, kind, scheduled_at) do nothing;

  return query
  update public.event_emails m
  set attempts = m.attempts + 1,
      next_attempt_at = now() + interval '5 minutes'
  where m.id = (
    select q.id from public.event_emails q
    join public.events e on e.id = q.event_id
    join auth.users u on u.id = e.owner_id
    where q.sent_at is null and q.next_attempt_at <= now()
      and q.attempts < 12
      -- Resend retains idempotency keys for 24h. Never replay beyond that.
      and q.created_at > now() - interval '23 hours'
      and q.capture_end_at = e.capture_end_at
      and q.scheduled_at = public.event_email_due_at(e.capture_end_at, e.time_zone, q.kind)
      and u.email = q.snapshot->>'recipient' and u.deleted_at is null
      and (q.kind <> 'upcoming' or e.capture_end_at > now())
    order by q.next_attempt_at, q.id
    limit 1 for update of q skip locked
  )
  returning m.*;
end;
$$;
revoke all on function public.claim_event_email() from public, anon, authenticated;
grant execute on function public.claim_event_email() to service_role;

-- Same Vault credentials as the export and invoice sweep. With no local Vault
-- secrets this is a no-op; tests must never call a deployed endpoint.
select cron.schedule('event-emails-sweep-http', '*/5 * * * *', $$
  select net.http_post(
    url := s.api_url || '/api/event-emails/sweep',
    headers := jsonb_build_object('authorization', 'Bearer ' || s.secret, 'content-type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  from (
    select
      (select decrypted_secret from vault.decrypted_secrets where name = 'ourfilm_api_url' limit 1) as api_url,
      (select decrypted_secret from vault.decrypted_secrets where name = 'export_worker_secret' limit 1) as secret
  ) s
  where s.api_url is not null and s.secret is not null
$$);
