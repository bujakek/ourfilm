-- The disposable camera pivot: every access path.
--
-- Two rules carried over from the old schema, because they are still the ones
-- that matter:
--
--   1. Guests never read tables. The anon key ships in the browser bundle, so
--      anything anon can select through PostgREST, anyone on the internet can
--      list. Guest reads go through security-definer functions that require a
--      slug or a session token, so there is nothing to enumerate.
--
--   2. Enforcement lives here, never in the caller. A hidden button is
--      decoration; the database is what refuses.
--
-- New in this file: the guest **write** path is service-role only. Guests hold
-- no insert policy on `photos` and none on `storage.objects` any more. Every
-- capture goes through a server action which holds the session cookie, so the
-- shot limit is not something a hand-rolled fetch with the anon key can reach.

-- ---------------------------------------------------------------------------
-- Entitlement
-- ---------------------------------------------------------------------------

-- The free tier, in one place. This is now a **participant** cap, not a photo
-- cap: an event is free for up to five distinct guests, each of whom gets the
-- host's chosen roll of 5/10/16/24/36. Five guests × 36 shots is a legitimate
-- free event.
create or replace function public.free_participant_limit()
returns integer
language sql
immutable
as $$ select 5 $$;

-- Why an event is uncapped: somebody paid for it, or it belongs to an admin.
-- The second clause is how the operator runs the pilot wedding without charging
-- themselves. Unchanged in substance from `event_has_unlimited_uploads` — only
-- the thing it unlocks moved from photos to participants, so the whole Stripe
-- flow above it keeps working untouched.
create or replace function public.event_is_full_plan(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and (
        exists (
          select 1 from public.purchases pu
          where pu.event_id = e.id and pu.status = 'paid'
        )
        or exists (
          select 1 from public.profiles pr
          where pr.id = e.owner_id and pr.role = 'admin'
        )
      )
  )
$$;

-- A count that stops as soon as it has seen enough, for the same reason the old
-- photo count did: it runs on the join path and must not grow with the event.
create or replace function public.event_participant_count_capped(p_event_id uuid, p_cap integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from (
    select 1
    from public.participants p
    where p.event_id = p_event_id
    limit p_cap
  ) capped
$$;

-- What the host's dashboard prints as "{n} / 5 résztvevő". Not granted to anon:
-- unlike the old photo quota, a guest has no decision to make with this number
-- and the refusal copy deliberately does not offer them a checkout.
create or replace function public.event_participant_quota(p_event_id uuid)
returns table (
  participant_limit integer,
  participant_count integer,
  unlimited         boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.free_participant_limit() as participant_limit,
    (select count(*)::integer from public.participants p where p.event_id = p_event_id)
      as participant_count,
    public.event_is_full_plan(p_event_id) as unlimited
$$;

revoke all on function public.free_participant_limit() from public;
revoke all on function public.event_is_full_plan(uuid) from public;
revoke all on function public.event_participant_count_capped(uuid, integer) from public;
revoke all on function public.event_participant_quota(uuid) from public;
grant execute on function public.event_participant_quota(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Joining
-- ---------------------------------------------------------------------------

-- Create or resume a participant session.
--
-- The concurrency requirement is the whole reason this is plpgsql rather than a
-- sql function: five parallel joins on a free event must not produce six
-- participants. The `for update` on the event row serialises the count-then-
-- insert for that one event. It is taken only when a *new* participant is
-- joining — a returning guest never reaches it — so the cost is one row lock
-- per device per event, and never on the capture path.
--
-- A guest who has already joined is never turned away, even once the cap is
-- full. Their session predates the limit and revoking it mid-event would be the
-- worst possible moment to tell someone the host has not paid.
create or replace function public.join_event(
  p_slug       text,
  p_name       text,
  p_token_hash text
)
returns table (
  participant_id uuid,
  display_name   text,
  cap_reached    boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_name     text;
  v_existing public.participants%rowtype;
  v_count    integer;
begin
  select e.id into v_event_id
  from public.events e
  where e.slug = p_slug;

  -- No such event. The caller renders a 404; saying so here would let anyone
  -- with the anon key test slugs for existence.
  if v_event_id is null then
    return;
  end if;

  v_name := nullif(btrim(p_name), '');
  if v_name is null then
    raise exception 'A név nem lehet üres.' using errcode = 'check_violation';
  end if;
  v_name := left(v_name, 40);

  -- Resume first, and without the lock. This is the common path: every
  -- navigation, every refresh, every reopened link.
  select * into v_existing
  from public.participants p
  where p.event_id = v_event_id
    and p.session_token_hash = p_token_hash;

  if found then
    update public.participants p
       set last_seen_at = now(),
           display_name = v_name
     where p.id = v_existing.id;

    return query select v_existing.id, v_name, false;
    return;
  end if;

  -- New participant. Hold the event row so the count below cannot be stale by
  -- the time the insert lands.
  if not public.event_is_full_plan(v_event_id) then
    perform 1 from public.events e where e.id = v_event_id for update;

    v_count := public.event_participant_count_capped(
      v_event_id, public.free_participant_limit()
    );

    if v_count >= public.free_participant_limit() then
      return query select null::uuid, null::text, true;
      return;
    end if;
  end if;

  -- `on conflict` covers the one race the lock does not: the same device
  -- submitting the form twice, which is two inserts with the same token rather
  -- than two different guests.
  insert into public.participants (event_id, display_name, session_token_hash)
  values (v_event_id, v_name, p_token_hash)
  on conflict (event_id, session_token_hash)
    do update set last_seen_at = now(), display_name = excluded.display_name
  returning public.participants.id into v_existing.id;

  return query select v_existing.id, v_name, false;
end;
$$;

-- ---------------------------------------------------------------------------
-- Capturing
-- ---------------------------------------------------------------------------

-- How long a reserved-but-uncommitted shot holds its slot.
--
-- A guest whose upload dies mid-flight must not lose the frame, but the slot
-- also cannot be held forever or a stalled tab would silently shorten someone's
-- roll. Ten minutes is far longer than any upload on venue wifi and short
-- enough that a guest who retries has their shot back before they notice.
--
-- This is the whole expiry mechanism. There is no sweeper job and nothing to
-- schedule: an expired reservation simply stops being counted.
create or replace function public.shot_reservation_ttl()
returns interval
language sql
immutable
as $$ select interval '10 minutes' $$;

-- Shots a participant has actually spent.
--
-- Counts committed photos plus reservations still inside their TTL. Hidden
-- photos count: `hidden_at` is moderation, not deletion — the object still
-- exists and still cost the guest a frame, so a host tidying up the album must
-- not silently hand out more film.
create or replace function public.participant_shots_used(p_participant_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.photos p
  where p.participant_id = p_participant_id
    and (
      p.status = 'ready'
      or p.created_at > now() - public.shot_reservation_ttl()
    )
$$;

-- Reserve one frame.
--
-- This is the atomicity boundary for the whole feature. `for update` on the
-- participant row means a guest's own concurrent captures — a double-tapped
-- shutter, two tabs, a retry racing the original — serialise against each
-- other. It deliberately does **not** lock the event: participants are
-- independent rolls of film, and locking the event would serialise every guest
-- at the party behind one another on the busiest path in the product.
--
-- Returns a refusal string rather than raising, because every refusal here is a
-- thing the guest UI has to say in Hungarian, and an exception would arrive as
-- an opaque PostgREST error.
create or replace function public.reserve_shot(
  p_event_id        uuid,
  p_token_hash      text,
  p_idempotency_key text
)
returns table (
  photo_id        uuid,
  storage_path    text,
  view_path       text,
  thumb_path      text,
  shots_remaining integer,
  refusal         text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_participant public.participants%rowtype;
  v_event       public.events%rowtype;
  v_existing    public.photos%rowtype;
  v_used        integer;
  v_photo_id    uuid;
  v_prefix      text;
begin
  -- The lock and the identity check are the same statement. A token that
  -- matches nothing locks nothing and falls straight through.
  select * into v_participant
  from public.participants p
  where p.event_id = p_event_id
    and p.session_token_hash = p_token_hash
  for update;

  if not found then
    return query select null::uuid, null::text, null::text, null::text, 0, 'no_session';
    return;
  end if;

  select * into v_event from public.events e where e.id = p_event_id;

  -- The window is checked here and not only in the UI. A guest who keeps the
  -- camera page open past the end of the event holds a page that says it can
  -- shoot; this is what makes it wrong.
  if now() < v_event.capture_start_at then
    return query select null::uuid, null::text, null::text, null::text, 0, 'not_started';
    return;
  end if;
  if now() > v_event.capture_end_at then
    return query select null::uuid, null::text, null::text, null::text, 0, 'ended';
    return;
  end if;

  -- Idempotent retry. The key is minted once per shutter press, so a guest
  -- retrying a failed upload lands here and gets the same frame back rather
  -- than spending a second one.
  select * into v_existing
  from public.photos p
  where p.participant_id = v_participant.id
    and p.idempotency_key = p_idempotency_key;

  if found then
    return query select
      v_existing.id, v_existing.storage_path, v_existing.view_path, v_existing.thumb_path,
      greatest(v_event.shots_per_participant - public.participant_shots_used(v_participant.id), 0),
      null::text;
    return;
  end if;

  v_used := public.participant_shots_used(v_participant.id);

  if v_used >= v_event.shots_per_participant then
    return query select null::uuid, null::text, null::text, null::text, 0, 'no_shots';
    return;
  end if;

  v_photo_id := gen_random_uuid();
  -- The layout every storage policy reads: the first path segment is the event
  -- id, always. Built here rather than in the caller so the row and the objects
  -- cannot disagree about where the bytes went.
  v_prefix := p_event_id::text || '/' || v_photo_id::text;

  insert into public.photos (
    id, event_id, participant_id, status, idempotency_key,
    storage_path, view_path, thumb_path, mime_type
  ) values (
    v_photo_id, p_event_id, v_participant.id, 'pending', p_idempotency_key,
    v_prefix || '.jpg', v_prefix || '_view.jpg', v_prefix || '_thumb.jpg', 'image/jpeg'
  );

  return query select
    v_photo_id, v_prefix || '.jpg', v_prefix || '_view.jpg', v_prefix || '_thumb.jpg',
    greatest(v_event.shots_per_participant - (v_used + 1), 0),
    null::text;
end;
$$;

-- Commit a reserved frame once its three renders are in Storage.
--
-- Scoped by token hash as well as photo id: knowing a photo id must not be
-- enough to commit someone else's reservation.
create or replace function public.commit_shot(
  p_photo_id   uuid,
  p_token_hash text,
  p_width      integer,
  p_height     integer,
  p_byte_size  integer,
  p_taken_at   timestamptz
)
returns table (shots_remaining integer, committed boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_participant_id uuid;
  v_event_id       uuid;
  v_shots          smallint;
begin
  select p.participant_id, p.event_id into v_participant_id, v_event_id
  from public.photos p
  join public.participants pa on pa.id = p.participant_id
  where p.id = p_photo_id
    and pa.session_token_hash = p_token_hash;

  if v_participant_id is null then
    return query select 0, false;
    return;
  end if;

  update public.photos p
     set status    = 'ready',
         width     = p_width,
         height    = p_height,
         byte_size = p_byte_size,
         taken_at  = p_taken_at
   where p.id = p_photo_id;

  select e.shots_per_participant into v_shots
  from public.events e where e.id = v_event_id;

  return query select
    greatest(v_shots - public.participant_shots_used(v_participant_id), 0),
    true;
end;
$$;

-- Hand back a frame whose upload failed.
--
-- Best effort and not load-bearing: the TTL above already releases an abandoned
-- reservation. This just makes it immediate for the common case where the guest
-- is still on the page and about to try again.
--
-- Only ever deletes a `pending` row, so a late call cannot destroy a photo that
-- committed in the meantime.
create or replace function public.release_shot(
  p_photo_id   uuid,
  p_token_hash text
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.photos p
  using public.participants pa
  where p.id = p_photo_id
    and pa.id = p.participant_id
    and pa.session_token_hash = p_token_hash
    and p.status = 'pending'
$$;

-- The write path is service-role only. These are reachable exclusively from
-- server actions, which are the only things that hold the httpOnly session
-- cookie; granting them to anon would make the token hash — a value that must
-- be presentable but is not secret once observed — sufficient on its own.
revoke all on function public.join_event(text, text, text) from public;
revoke all on function public.reserve_shot(uuid, text, text) from public;
revoke all on function public.commit_shot(uuid, text, integer, integer, integer, timestamptz) from public;
revoke all on function public.release_shot(uuid, text) from public;
revoke all on function public.participant_shots_used(uuid) from public;
revoke all on function public.shot_reservation_ttl() from public;

grant execute on function public.join_event(text, text, text) to service_role;
grant execute on function public.reserve_shot(uuid, text, text) to service_role;
grant execute on function public.commit_shot(uuid, text, integer, integer, integer, timestamptz) to service_role;
grant execute on function public.release_shot(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------

-- Everything the guest surface needs about an event, in one round trip.
--
-- The permission booleans are computed here rather than by the caller, so the
-- page, the camera and the gallery cannot drift apart about what is allowed.
-- Capture and viewing are separate rights on purpose: an event can be shooting
-- with the gallery still closed, or revealed long after the camera stopped.
--
-- `can_guest_view_gallery` is the reveal instant AND the host's guest-visibility
-- switch. The host's own view never consults it — /admin reads the tables under
-- ownership RLS — which is what lets a host moderate before the reveal.
create or replace function public.event_guest_state(
  p_slug       text,
  p_token_hash text
)
returns table (
  id                       uuid,
  slug                     text,
  event_name               text,
  cover_path               text,
  host_name                text,
  time_zone                text,
  capture_start_at         timestamptz,
  capture_end_at           timestamptz,
  reveal_mode              public.reveal_mode,
  reveal_at                timestamptz,
  shots_per_participant    smallint,
  participant_id           uuid,
  display_name             text,
  can_capture              boolean,
  can_guest_view_gallery   boolean,
  shots_remaining          integer,
  participant_limit_reached boolean,
  photo_count              integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.id,
    e.slug,
    e.event_name,
    e.cover_path,
    -- Shown as "szervező" on the join screen when the host set a display name
    -- on their account. Most have not, so the UI must render without it.
    (u.raw_user_meta_data ->> 'full_name') as host_name,
    e.time_zone,
    e.capture_start_at,
    e.capture_end_at,
    e.reveal_mode,
    e.reveal_at,
    e.shots_per_participant,
    p.id as participant_id,
    p.display_name,
    -- A guest who has not joined cannot capture either; the join screen is what
    -- they get instead.
    (p.id is not null
      and now() >= e.capture_start_at
      and now() <= e.capture_end_at) as can_capture,
    (e.guests_can_view and now() >= e.reveal_at) as can_guest_view_gallery,
    case
      when p.id is null then e.shots_per_participant::integer
      else greatest(e.shots_per_participant - public.participant_shots_used(p.id), 0)
    end as shots_remaining,
    -- Only ever true for someone who is *not* already in. A joined guest is
    -- never told the event is full.
    (p.id is null
      and not public.event_is_full_plan(e.id)
      and public.event_participant_count_capped(e.id, public.free_participant_limit())
            >= public.free_participant_limit()) as participant_limit_reached,
    coalesce(c.photo_count, 0)::integer as photo_count
  from public.events e
  join auth.users u on u.id = e.owner_id
  left join public.participants p
    on p.event_id = e.id and p.session_token_hash = p_token_hash
  left join lateral (
    select count(*) as photo_count
    from public.photos ph
    where ph.event_id = e.id
      and ph.status = 'ready'
      and ph.hidden_at is null
  ) c on true
  where e.slug = p_slug
$$;

-- The guest gallery.
--
-- The reveal check is in the `where` clause, not in the caller. A guest calling
-- this directly before the reveal gets zero rows, which is the same answer the
-- page gives — and the only one that holds when the caller is curl.
create or replace function public.event_gallery_by_slug(p_slug text)
returns table (
  id            uuid,
  storage_path  text,
  thumb_path    text,
  view_path     text,
  uploader_name text,
  width         integer,
  height        integer,
  created_at    timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.storage_path, p.thumb_path, p.view_path,
         pa.display_name as uploader_name,
         p.width, p.height, p.created_at
  from public.photos p
  join public.events e on e.id = p.event_id
  join public.participants pa on pa.id = p.participant_id
  where e.slug = p_slug
    and p.hidden_at is null
    and p.status = 'ready'
    and e.guests_can_view
    and now() >= e.reveal_at
  order by p.created_at desc
$$;

revoke all on function public.event_guest_state(text, text) from public;
revoke all on function public.event_gallery_by_slug(text) from public;
grant execute on function public.event_guest_state(text, text) to service_role;
grant execute on function public.event_gallery_by_slug(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Host overview
-- ---------------------------------------------------------------------------

-- Rebuilt for the new columns. Still SECURITY INVOKER: the host's own RLS
-- policies are the authorization boundary, and a definer function here would
-- quietly become a way to read every event.
create or replace function public.owned_events_with_previews()
returns table (
  id                    uuid,
  slug                  text,
  event_name            text,
  cover_path            text,
  capture_start_at      timestamptz,
  capture_end_at        timestamptz,
  reveal_mode           public.reveal_mode,
  reveal_at             timestamptz,
  shots_per_participant smallint,
  guests_can_view       boolean,
  created_at            timestamptz,
  photo_count           integer,
  participant_count     integer,
  previews              text[]
)
language sql
stable
set search_path = ''
as $$
  select
    e.id, e.slug, e.event_name, e.cover_path,
    e.capture_start_at, e.capture_end_at,
    e.reveal_mode, e.reveal_at,
    e.shots_per_participant, e.guests_can_view, e.created_at,
    coalesce(c.photo_count, 0)::integer,
    coalesce(pc.participant_count, 0)::integer,
    coalesce(c.previews, array[]::text[])
  from public.events e
  left join lateral (
    select count(*) as photo_count,
           (array_agg(t.thumb_path order by t.created_at desc))[1:4] as previews
    from public.photos t
    where t.event_id = e.id
      and t.hidden_at is null
      and t.status = 'ready'
  ) c on true
  left join lateral (
    select count(*) as participant_count
    from public.participants pt
    where pt.event_id = e.id
  ) pc on true
  order by e.created_at desc
$$;

revoke all on function public.owned_events_with_previews() from public, anon;
grant execute on function public.owned_events_with_previews() to authenticated;
