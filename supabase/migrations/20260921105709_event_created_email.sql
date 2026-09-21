-- Creation confirmation joins the existing outbox and five-minute sweep.
-- Queue atomically with the event: a lost response or repeated draft cannot
-- lose or duplicate this mail. No backfill for events that already exist.
alter table public.event_emails drop constraint event_emails_kind_check;
alter table public.event_emails add constraint event_emails_kind_check
  check (kind in ('created', 'upcoming', 'ended'));
create unique index event_emails_created_once_idx on public.event_emails(event_id)
  where kind = 'created';

-- Definer is necessary: hosts may create events but cannot write the outbox.
-- The trigger only uses the inserted row, performs no network IO, and never
-- exposes recipients. The claim takes the current settings before first send.
create function public.queue_event_created_email()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.event_emails(event_id, kind, capture_end_at, scheduled_at, snapshot)
  values (new.id, 'created', new.capture_end_at, now(), '{}'::jsonb);
  return new;
end;
$$;
revoke all on function public.queue_event_created_email() from public, anon, authenticated;
grant execute on function public.queue_event_created_email() to service_role;
create trigger events_queue_created_email after insert on public.events
for each row execute function public.queue_event_created_email();

-- Confirmation is about creation, so changing the date never queues it again.
-- Refresh its settings until a provider body exists; retries reuse that body.
create or replace function public.claim_event_email()
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
  set snapshot = case when m.kind = 'created' and m.payload is null then (
        select jsonb_build_object(
          'locale', e.locale, 'eventName', e.event_name, 'slug', e.slug,
          'recipient', u.email, 'photoCount', 0,
          'captureEndAt', e.capture_end_at, 'timeZone', e.time_zone,
          'revealMode', e.reveal_mode, 'revealAt', e.reveal_at,
          'guestsCanView', e.guests_can_view
        )
        from public.events e join auth.users u on u.id = e.owner_id
        where e.id = m.event_id
      ) else m.snapshot end,
      attempts = m.attempts + 1,
      next_attempt_at = now() + interval '5 minutes'
  where m.id = (
    select q.id from public.event_emails q
    join public.events e on e.id = q.event_id
    join auth.users u on u.id = e.owner_id
    where q.sent_at is null and q.next_attempt_at <= now()
      and q.attempts < 12
      -- Resend retains idempotency keys for 24h. Never replay beyond that.
      and q.created_at > now() - interval '23 hours'
      and (q.kind = 'created' or (
        q.capture_end_at = e.capture_end_at
        and q.scheduled_at = public.event_email_due_at(e.capture_end_at, e.time_zone, q.kind)
      ))
      and u.email is not null and u.deleted_at is null
      and ((q.kind = 'created' and q.payload is null) or u.email = q.snapshot->>'recipient')
      and (q.kind = 'ended' or e.capture_end_at > now())
    order by q.next_attempt_at, q.id
    limit 1 for update of q skip locked
  )
  returning m.*;
end;
$$;
revoke all on function public.claim_event_email() from public, anon, authenticated;
grant execute on function public.claim_event_email() to service_role;

