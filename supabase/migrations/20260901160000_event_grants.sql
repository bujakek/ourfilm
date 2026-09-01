-- Comped events: the Early Couple Program, and the operator's manual lever.
--
-- Until now an event was uncapped for exactly two reasons — a settled Stripe
-- payment, or an admin owner. The Early Couple Program needs a third, and
-- neither of the obvious shortcuts is safe:
--
--   * Hand-writing `purchases.status = 'paid'` would need a fabricated
--     `stripe_checkout_session_id` (the column is `not null unique`) and would
--     make the billing card tell a couple they were charged 12 900 Ft when no
--     money moved. `purchases` is a Stripe ledger; a comp is not a Stripe
--     event, and phantom revenue there is a problem again at invoicing time.
--   * A 100%-off Stripe coupon completes checkout with
--     `payment_status = 'no_payment_required'`, which the webhook deliberately
--     ignores (it only settles `'paid'`), so the couple would pay nothing and
--     stay capped. It is also a bearer token: one leaked promotion code is
--     unlimited guests for anybody who has it.
--
-- So entitlement grows a third clause of its own, recorded in its own table.

create table public.event_grants (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  reason     text not null check (reason in ('early_couple', 'operator')),
  -- Null when the grant came from the service role — the CLI in
  -- `scripts/grant-event.ts` has no `auth.uid()` to record. Kept so a future
  -- operator console can fill it in without a migration.
  granted_by uuid references auth.users (id) on delete set null,
  note       text,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

comment on table public.event_grants is
  'Why an event is uncapped without a payment. A ledger: revoking sets '
  'revoked_at rather than deleting the row.';

create index event_grants_event_idx on public.event_grants (event_id);

-- One *active* grant per event, while keeping every revoked one. A plain
-- unique constraint on event_id would make re-granting a previously revoked
-- event impossible without destroying the record of the first grant.
create unique index event_grants_one_active_idx
  on public.event_grants (event_id)
  where revoked_at is null;

alter table public.event_grants enable row level security;

-- No policies at all, in either direction. A host must never be able to read
-- their own grant into existence, and `revoke ... from public` alone would not
-- be enough: Supabase grants the API roles directly, so they are named here.
revoke all on public.event_grants from anon, authenticated;
grant all privileges on table public.event_grants to service_role;

-- ---------------------------------------------------------------------------
-- Entitlement
-- ---------------------------------------------------------------------------

-- Why an event is uncapped, or null when it is not. Replaces the boolean as
-- the single source of that answer so the host's settings screen can say the
-- true thing rather than reusing the paid copy for every case.
--
-- Returns the grant's own `reason` rather than a flat 'grant', because an
-- Early Couple comp and an operator unlock are not the same sentence to put in
-- front of a host. So the vocabulary is:
--   'paid' | 'early_couple' | 'operator' | 'admin' | null
--
-- Ordered: a couple who was granted a comp and later paid anyway reads as
-- 'paid', because that is the one with a receipt behind it. The partial unique
-- index above is what makes the grant subquery safely scalar.
create or replace function public.event_plan_source(p_event_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.purchases pu
      where pu.event_id = p_event_id and pu.status = 'paid'
    ) then 'paid'
    else coalesce(
      (
        select g.reason
        from public.event_grants g
        where g.event_id = p_event_id and g.revoked_at is null
      ),
      (
        select 'admin'
        from public.events e
        join public.profiles pr on pr.id = e.owner_id
        where e.id = p_event_id and pr.role = 'admin'
      )
    )
  end
$$;

revoke all on function public.event_plan_source(uuid) from public, anon, authenticated;

-- Unchanged in meaning and signature — `join_event`, the guest state view and
-- the checkout guard all keep calling this and pick the new clause up for
-- free. It is now only a null check over the reason.
create or replace function public.event_is_full_plan(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.event_plan_source(p_event_id) is not null
$$;

revoke all on function public.event_is_full_plan(uuid) from public, anon, authenticated;

-- Gains `plan_source`. A `returns table` cannot be widened by `create or
-- replace`, so this is a drop and recreate — which also drops the grants, so
-- they are restated below rather than inherited.
drop function public.event_participant_quota(uuid);

create function public.event_participant_quota(p_event_id uuid)
returns table (
  participant_limit integer,
  participant_count integer,
  unlimited         boolean,
  plan_source       text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.free_participant_limit(),
    (select count(*)::integer from public.participants p where p.event_id = p_event_id),
    src.source is not null,
    src.source
  from (select public.event_plan_source(p_event_id) as source) src
$$;

-- Host-only, exactly as before: a guest turned away by the cap is deliberately
-- shown no checkout, so they have no decision to make with this number.
--
-- `service_role` is named explicitly because dropping the function dropped
-- every grant it had, and a clean `supabase db reset` does not hand the new one
-- back — the same divergence `20260831150000_explicit_api_role_privileges.sql`
-- exists to close. Without it `pnpm grant` cannot read back the state it just
-- wrote, which is how the database suite caught this.
revoke all on function public.event_participant_quota(uuid) from public, anon, authenticated;
grant execute on function public.event_participant_quota(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Operator RPCs
-- ---------------------------------------------------------------------------

-- Idempotent on purpose: a founder running the CLI twice after a patchy call
-- should land on the grant the first run made, not on an error. The partial
-- unique index is what makes that safe under a genuine race.
create or replace function public.grant_event_plan(
  p_event_slug text,
  p_reason     text,
  p_note       text default null,
  p_granted_by uuid default null
)
returns table (
  -- Deliberately not named `event_id`: a plpgsql OUT parameter sharing a name
  -- with a column makes the `on conflict (event_id)` target below ambiguous.
  grant_id         uuid,
  granted_event_id uuid,
  already_active   boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_existing uuid;
  v_new      uuid;
begin
  select e.id into v_event_id from public.events e where e.slug = p_event_slug;
  if v_event_id is null then
    raise exception 'No event with slug %', p_event_slug using errcode = 'no_data_found';
  end if;

  insert into public.event_grants (event_id, reason, note, granted_by)
  values (v_event_id, p_reason, p_note, p_granted_by)
  on conflict (event_id) where revoked_at is null do nothing
  returning id into v_new;

  if v_new is not null then
    return query select v_new, v_event_id, false;
    return;
  end if;

  select g.id into v_existing
  from public.event_grants g
  where g.event_id = v_event_id and g.revoked_at is null;

  return query select v_existing, v_event_id, true;
end;
$$;

-- Revoking is an emergency lever, not a lifecycle step. `event_is_full_plan`
-- is consulted on every join, so revoking mid-wedding starts turning guests
-- away at the worst possible moment — the same reason the free cap never
-- evicts a guest who has already joined. In particular: never wire this to an
-- `early_couple_applications.status` transition, which moves to 'completed'
-- after the wedding and would re-cap a live album.
create or replace function public.revoke_event_plan(
  p_event_slug text,
  p_note       text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_revoked  uuid;
begin
  select e.id into v_event_id from public.events e where e.slug = p_event_slug;
  if v_event_id is null then
    raise exception 'No event with slug %', p_event_slug using errcode = 'no_data_found';
  end if;

  update public.event_grants g
  set revoked_at = now(),
      note = coalesce(p_note, g.note)
  where g.event_id = v_event_id and g.revoked_at is null
  returning g.id into v_revoked;

  return v_revoked is not null;
end;
$$;

revoke all on function public.grant_event_plan(text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.grant_event_plan(text, text, text, uuid) to service_role;

revoke all on function public.revoke_event_plan(text, text)
  from public, anon, authenticated;
grant execute on function public.revoke_event_plan(text, text) to service_role;
