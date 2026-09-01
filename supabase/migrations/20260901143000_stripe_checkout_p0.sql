-- Stripe Checkout P0 hardening.
--
-- Purchases remain a ledger: every Stripe Session that reaches a terminal
-- state gets a row, even when an earlier Session for the same event was paid.
-- The separate attempt table only coordinates Session *creation*. Concurrent
-- requests for one event receive the same attempt id, which is used as the
-- Stripe idempotency key, so two tabs cannot create two payable Sessions.

alter type public.purchase_status add value if not exists 'failed';
alter type public.purchase_status add value if not exists 'expired';

alter table public.purchases
  add column failed_at timestamptz,
  add column expired_at timestamptz;

create table public.stripe_checkout_attempts (
  event_id          uuid primary key references public.events (id) on delete cascade,
  attempt_id        uuid not null default gen_random_uuid(),
  terms_accepted_at timestamptz not null,
  expires_at        timestamptz not null,
  created_at        timestamptz not null default now()
);

alter table public.stripe_checkout_attempts enable row level security;
revoke all on public.stripe_checkout_attempts from anon, authenticated;

-- Atomically reserve one attempt for an event. The row is deliberately never
-- exposed through table policies: a host reaches it only through this function,
-- which verifies ownership and returns no Stripe identifiers or payment data.
--
-- The caller supplies the acceptance time because it was stamped by the server
-- only after the checkbox was checked. Reusers receive the first request's
-- canonical timestamp so every Stripe retry has byte-for-byte identical params.
create or replace function public.reserve_event_checkout(
  p_event_id uuid,
  p_terms_accepted_at timestamptz,
  p_ttl_seconds integer default 2700
)
returns table (
  attempt_id uuid,
  expires_at timestamptz,
  terms_accepted_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_attempt_id uuid;
  v_expires_at timestamptz;
  v_terms_accepted_at timestamptz;
begin
  if auth.uid() is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if p_terms_accepted_at is null then
    raise invalid_parameter_value using message = 'Terms acceptance is required';
  end if;

  -- Stripe Checkout accepts an expiry between 30 minutes and 24 hours. Keep
  -- the same bounds here so the reservation can always be sent to Stripe.
  if p_ttl_seconds < 1800 or p_ttl_seconds > 86400 then
    raise invalid_parameter_value using message = 'Invalid checkout attempt TTL';
  end if;

  if not exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and (e.owner_id = auth.uid() or public.is_admin())
  ) then
    raise insufficient_privilege using message = 'Event not found';
  end if;

  if exists (
    select 1
    from public.purchases p
    where p.event_id = p_event_id and p.status = 'paid'
  ) then
    raise check_violation using message = 'Event is already paid';
  end if;

  insert into public.stripe_checkout_attempts as a (
    event_id,
    attempt_id,
    terms_accepted_at,
    expires_at,
    created_at
  )
  values (
    p_event_id,
    gen_random_uuid(),
    p_terms_accepted_at,
    v_now + make_interval(secs => p_ttl_seconds),
    v_now
  )
  on conflict (event_id) do update
  set
    attempt_id = gen_random_uuid(),
    terms_accepted_at = excluded.terms_accepted_at,
    expires_at = excluded.expires_at,
    created_at = excluded.created_at
  where a.expires_at <= v_now
  returning a.attempt_id, a.expires_at, a.terms_accepted_at
  into v_attempt_id, v_expires_at, v_terms_accepted_at;

  -- ON CONFLICT ... WHERE returns no row while an unexpired reservation exists.
  -- The conflicting row is locked before this select, so concurrent callers
  -- either all see the old attempt or all see its single replacement.
  if v_attempt_id is null then
    select a.attempt_id, a.expires_at, a.terms_accepted_at
    into v_attempt_id, v_expires_at, v_terms_accepted_at
    from public.stripe_checkout_attempts a
    where a.event_id = p_event_id;
  end if;

  return query
  select v_attempt_id, v_expires_at, v_terms_accepted_at;
end
$$;

revoke all on function public.reserve_event_checkout(uuid, timestamptz, integer)
  from public, anon;
grant execute on function public.reserve_event_checkout(uuid, timestamptz, integer)
  to authenticated;
