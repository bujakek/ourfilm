-- A reservation must always have enough life left to be a Checkout Session's
-- expiry, not merely to exist.
--
-- `expires_at` is sent to Stripe verbatim, and Stripe refuses a Session whose
-- expiry is less than 30 minutes from *creation*. The reservation, though,
-- lives 45 minutes and is reused for all of them — so every session created
-- more than ~15 minutes into an attempt was rejected with "The `expires_at`
-- timestamp must be at least 30 minutes from Checkout Session creation."
--
-- Invisible until it wasn't: while the parameters were unchanged, a retry
-- replayed the idempotency key and Stripe returned the cached Session without
-- revalidating anything. The first request that genuinely differed - a
-- settlement flip, a deploy that adds a parameter - created a Session for real
-- and hit the rule.
--
-- So rotation is now driven by how much life the reservation has left rather
-- than by whether it has any. Sending an expiry Stripe will not accept is the
-- failure this closes; a slightly shorter de-duplication window is the cost,
-- and that window only ever needed to cover a double-tap.

create or replace function public.checkout_attempt_rotate_before()
returns interval
language sql
immutable
as $$
  -- Stripe's floor is 30 minutes; the surplus absorbs clock skew between
  -- Postgres and Stripe and the round trip in between.
  select interval '32 minutes'
$$;

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
  where a.expires_at <= v_now + public.checkout_attempt_rotate_before()
  returning a.attempt_id, a.expires_at, a.terms_accepted_at
  into v_attempt_id, v_expires_at, v_terms_accepted_at;

  -- ON CONFLICT ... WHERE returns no row while a reservation with enough life
  -- left exists. The conflicting row is locked before this select, so
  -- concurrent callers either all see the old attempt or all see its single
  -- replacement.
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

revoke all on function public.checkout_attempt_rotate_before() from public;
grant execute on function public.checkout_attempt_rotate_before()
  to authenticated, service_role;
