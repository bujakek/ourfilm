-- A host's language belongs to the host, not to the event.
--
-- Until now everything a host read — the event screens, the reminder and
-- thank-you mail, the album-ready mail, Stripe's page — followed
-- `events.locale`, which is simply the language the site happened to be in
-- when the event was created. A phone set to English created English events
-- and got English mail nobody had chosen. Guests no longer read that column
-- either: the guest page follows the guest's own phone.
--
-- So the language moves to the profile: set once at signup from the language
-- the host signed up in, changeable on the account screen, and read by every
-- host-facing surface. `events.locale` is still written and no longer read by
-- the app; dropping it is a separate, destructive change for later.

alter table public.profiles
  add column locale text,
  add constraint profiles_locale_check
    check (locale is null or locale in ('en', 'hu'));

-- Existing hosts keep the language their mail already arrives in: that of
-- their most recent event. Accounts with no event stay null until they sign
-- in again or choose one.
update public.profiles p
set locale = latest.locale
from (
  select distinct on (e.owner_id) e.owner_id, e.locale
  from public.events e
  where e.locale in ('en', 'hu')
  order by e.owner_id, e.created_at desc
) latest
where latest.owner_id = p.id
  and p.locale is null;

-- New accounts: the email sign-up puts the page's language in user metadata
-- (`lib/auth-link.ts`). Google carries none of ours; its callback fills the
-- gap through `set_host_locale(..., true)` below.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locale text := new.raw_user_meta_data->>'locale';
begin
  insert into public.profiles (id, locale)
  values (new.id, case when v_locale in ('en', 'hu') then v_locale end)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- The host's own write, through a function rather than a policy for the same
-- reason as `set_host_display_name`: `profiles` has no self-update policy and
-- must not get one, because RLS filters rows rather than columns and would
-- let the same request set `role = 'admin'`.
--
-- `p_only_if_unset` is the sign-in callback's form: it records the language
-- a host arrived in without overriding one they chose on purpose.
create or replace function public.set_host_locale(
  p_locale text,
  p_only_if_unset boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  if p_locale not in ('en', 'hu') then
    raise invalid_parameter_value using message = 'Unsupported locale';
  end if;

  update public.profiles
  set locale = p_locale
  where id = auth.uid()
    and (not p_only_if_unset or locale is null);
end;
$$;

revoke all on function public.set_host_locale(text, boolean) from public;
revoke all on function public.set_host_locale(text, boolean) from anon;
grant execute on function public.set_host_locale(text, boolean) to authenticated;

-- Host event mail in the host's language. Identical to the definition in
-- `20260921105709_event_created_email.sql` except for the profile join and
-- `coalesce(p.locale, e.locale)` in both snapshots — the event's language is
-- only the fallback for an account with none on record.
create or replace function public.claim_event_email()
returns setof public.event_emails
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.event_emails(event_id, kind, capture_end_at, scheduled_at, snapshot)
  select e.id, k.kind, e.capture_end_at, d.due_at,
    jsonb_build_object(
      'locale', coalesce(p.locale, e.locale), 'eventName', e.event_name, 'slug', e.slug,
      'recipient', u.email,
      'photoCount', (select count(*) from public.photos p where p.event_id = e.id and p.status = 'ready' and p.deleted_at is null)
    )
  from public.events e
  join auth.users u on u.id = e.owner_id
  left join public.profiles p on p.id = e.owner_id
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
          'locale', coalesce(p.locale, e.locale), 'eventName', e.event_name, 'slug', e.slug,
          'recipient', u.email, 'photoCount', 0,
          'captureEndAt', e.capture_end_at, 'timeZone', e.time_zone,
          'revealMode', e.reveal_mode, 'revealAt', e.reveal_at,
          'guestsCanView', e.guests_can_view
        )
        from public.events e join auth.users u on u.id = e.owner_id
        left join public.profiles p on p.id = e.owner_id
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

