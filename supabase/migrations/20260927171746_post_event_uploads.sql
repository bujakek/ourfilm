-- Optional gallery uploads spend the same roll as camera captures. Existing
-- rows default off. Neither reveal_at nor the original capture window changes.
alter table public.events
  add column post_event_uploads_enabled boolean not null default false;

-- An expired reservation stops counting, so a stalled upload costs no frame.
-- Until now it could also still commit after its frame had been spent again,
-- which let a guest who waited out the TTL keep reserving past the roll. Both
-- `reserve_shot` (on replay) and `commit_shot` now re-check the roll before an
-- expired row goes any further, and a replay that passes stamps `reserved_at`
-- so the row counts again. `created_at` is left alone: it is the export's sort
-- fallback for a photo without EXIF, and a resume must not move the photo.
alter table public.photos add column reserved_at timestamptz;

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
      or coalesce(p.reserved_at, p.created_at) > now() - public.shot_reservation_ttl()
    )
$$;

create function public.reserve_shot(
  p_event_id          uuid,
  p_token_hash        text,
  p_idempotency_key   text,
  p_capture_started_at timestamptz,
  p_source text
)
returns table (
  photo_id             uuid,
  storage_path         text,
  view_path            text,
  thumb_path           text,
  shots_remaining      integer,
  refusal              text,
  late_seconds         integer,
  claimed_lead_seconds integer,
  photo_status         text,
  full_bytes           bigint,
  view_bytes           bigint,
  thumb_bytes          bigint
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
  v_late        integer;
  v_lead        integer;
  v_full        bigint;
  v_view        bigint;
  v_thumb       bigint;
begin
  select * into v_participant
  from public.participants p
  where p.event_id = p_event_id
    and p.session_token_hash = p_token_hash
  for update;

  if not found then
    return query select null::uuid, null::text, null::text, null::text, 0, 'no_session', null::integer, null::integer,
      null::text, null::bigint, null::bigint, null::bigint;
    return;
  end if;

  select * into v_event from public.events e where e.id = p_event_id;

  -- A reservation is stronger server-side evidence than any client timestamp.
  -- Replay it before applying either the capture window or the upload grace.
  select * into v_existing
  from public.photos p
  where p.participant_id = v_participant.id
    and p.idempotency_key = p_idempotency_key;

  if found then
    -- An expired reservation is no longer holding a frame, so it may only
    -- come back if the roll still has one. `participant_shots_used` already
    -- excludes this row, which is exactly the count to compare.
    if v_existing.status::text = 'pending'
      and coalesce(v_existing.reserved_at, v_existing.created_at)
        <= now() - public.shot_reservation_ttl()
    then
      if public.participant_shots_used(v_participant.id) >= v_event.shots_per_participant then
        return query select null::uuid, null::text, null::text, null::text, 0, 'no_shots', null::integer, null::integer,
          null::text, null::bigint, null::bigint, null::bigint;
        return;
      end if;
      update public.photos p set reserved_at = now() where p.id = v_existing.id;
    end if;

    if v_existing.status::text = 'pending' then
      -- `size` is whatever Storage's own trigger wrote, not something this
      -- function controls, so it is read defensively: a cast that raises turns
      -- into a refusal the queue waits on for up to 24 hours. A non-numeric
      -- value reads as "unknown" (null), same as an object with no metadata.
      select
        max(case when jsonb_typeof(o.metadata -> 'size') = 'number'
          then (o.metadata ->> 'size')::bigint end) filter (where o.name = v_existing.storage_path),
        max(case when jsonb_typeof(o.metadata -> 'size') = 'number'
          then (o.metadata ->> 'size')::bigint end) filter (where o.name = v_existing.view_path),
        max(case when jsonb_typeof(o.metadata -> 'size') = 'number'
          then (o.metadata ->> 'size')::bigint end) filter (where o.name = v_existing.thumb_path)
      into v_full, v_view, v_thumb
      from storage.objects o
      where o.bucket_id = 'event-photos'
        and o.name in (v_existing.storage_path, v_existing.view_path, v_existing.thumb_path);
    end if;

    return query select
      v_existing.id, v_existing.storage_path, v_existing.view_path, v_existing.thumb_path,
      greatest(v_event.shots_per_participant - public.participant_shots_used(v_participant.id), 0),
      null::text, null::integer, null::integer,
      v_existing.status::text, v_full, v_view, v_thumb;
    return;
  end if;

  if now() < v_event.capture_start_at then
    return query select null::uuid, null::text, null::text, null::text, 0, 'not_started', null::integer, null::integer,
      null::text, null::bigint, null::bigint, null::bigint;
    return;
  end if;

  -- Only a server-accepted reservation grants a late upload. The device's
  -- capture time is never an extension of the gallery-upload deadline.
  -- Joining after the close does not disqualify: the guest who never scanned
  -- the QR code at the party is exactly who this window is for. The roll and
  -- `join_event`'s participant cap still apply to them.
  if p_source = 'post_event' then
    if not v_event.post_event_uploads_enabled
      or now() <= v_event.capture_end_at
      or now() >= v_event.capture_end_at + interval '24 hours'
    then
      return query select null::uuid, null::text, null::text, null::text, 0, 'ended', null::integer, null::integer,
        null::text, null::bigint, null::bigint, null::bigint;
      return;
    end if;
  elsif p_source = 'camera' then
    -- The pre-existing camera recovery grace is independent of the option.
    if now() > v_event.capture_end_at and (
      now() > v_event.capture_end_at + public.shot_upload_grace()
      or p_capture_started_at is null
      or p_capture_started_at < v_event.capture_start_at
      or p_capture_started_at > v_event.capture_end_at
      or (v_participant.user_id is null and v_participant.joined_at > v_event.capture_end_at)
    ) then
      return query select null::uuid, null::text, null::text, null::text, 0, 'ended', null::integer, null::integer,
        null::text, null::bigint, null::bigint, null::bigint;
      return;
    end if;
  else
    return query select null::uuid, null::text, null::text, null::text, 0, 'ended', null::integer, null::integer,
      null::text, null::bigint, null::bigint, null::bigint;
    return;
  end if;

  v_used := public.participant_shots_used(v_participant.id);

  if v_used >= v_event.shots_per_participant then
    return query select null::uuid, null::text, null::text, null::text, 0, 'no_shots', null::integer, null::integer,
      null::text, null::bigint, null::bigint, null::bigint;
    return;
  end if;

  -- Past this point after the close, the grace is what let the shot in.
  if p_source = 'camera' and now() > v_event.capture_end_at then
    v_late := floor(extract(epoch from now() - v_event.capture_end_at))::integer;
    v_lead := floor(extract(epoch from v_event.capture_end_at - p_capture_started_at))::integer;
  end if;

  v_photo_id := gen_random_uuid();
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
    null::text, v_late, v_lead,
    'pending'::text, null::bigint, null::bigint, null::bigint;
end;
$$;

revoke all on function public.reserve_shot(uuid, text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.reserve_shot(uuid, text, text, timestamptz, text) to service_role;

-- Keep both old camera callers (including the host) working during rollout.
create or replace function public.reserve_shot(
  p_event_id uuid, p_token_hash text, p_idempotency_key text,
  p_capture_started_at timestamptz
)
returns table (
  photo_id uuid, storage_path text, view_path text, thumb_path text,
  shots_remaining integer, refusal text, late_seconds integer,
  claimed_lead_seconds integer, photo_status text,
  full_bytes bigint, view_bytes bigint, thumb_bytes bigint
)
language sql volatile security definer set search_path = '' as $$
  select * from public.reserve_shot(p_event_id, p_token_hash, p_idempotency_key, p_capture_started_at, 'camera')
$$;
revoke all on function public.reserve_shot(uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.reserve_shot(uuid, text, text, timestamptz) to service_role;

-- The same check at the other end. A caller who skips the replay and commits
-- an expired row directly must not get past the roll either, so the commit
-- takes the participant lock `reserve_shot` takes and refuses an expired
-- pending row whose frame has been spent since. A ready row stays idempotent.
-- The return type gains `refusal`, so this is a drop rather than a replace.
drop function public.commit_shot(uuid, text, integer, integer, integer, timestamptz);

create function public.commit_shot(
  p_photo_id   uuid,
  p_token_hash text,
  p_width      integer,
  p_height     integer,
  p_byte_size  integer,
  p_taken_at   timestamptz
)
returns table (shots_remaining integer, committed boolean, refusal text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_photo public.photos%rowtype;
  v_shots smallint;
begin
  select p.* into v_photo
  from public.photos p
  join public.participants pa on pa.id = p.participant_id
  where p.id = p_photo_id
    and pa.session_token_hash = p_token_hash;

  if not found then
    return query select 0, false, 'not_matched'::text;
    return;
  end if;

  perform 1 from public.participants pa where pa.id = v_photo.participant_id for update;

  select e.shots_per_participant into v_shots
  from public.events e where e.id = v_photo.event_id;

  -- Re-read under the lock: a concurrent commit of the same row may have
  -- finished while this one waited.
  select p.* into v_photo from public.photos p where p.id = p_photo_id;

  if v_photo.status::text = 'pending'
    and coalesce(v_photo.reserved_at, v_photo.created_at)
      <= now() - public.shot_reservation_ttl()
    and public.participant_shots_used(v_photo.participant_id) >= v_shots
  then
    return query select 0, false, 'no_shots'::text;
    return;
  end if;

  update public.photos p
     set status    = 'ready',
         width     = p_width,
         height    = p_height,
         byte_size = p_byte_size,
         taken_at  = p_taken_at
   where p.id = p_photo_id;

  return query select
    greatest(v_shots - public.participant_shots_used(v_photo.participant_id), 0),
    true,
    null::text;
end;
$$;

revoke all on function public.commit_shot(uuid, text, integer, integer, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.commit_shot(uuid, text, integer, integer, integer, timestamptz)
  to service_role;

-- A discarded local row only has its capture key, never a persisted photo id.
-- Release under the same participant lock as reserve so concurrent retries
-- cannot race this cancellation. A ready photo is never removed.
create function public.release_shot_by_capture(
  p_event_id uuid, p_token_hash text, p_idempotency_key text
)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare v_participant_id uuid;
begin
  select p.id into v_participant_id from public.participants p
  where p.event_id = p_event_id and p.session_token_hash = p_token_hash for update;
  if v_participant_id is null then return; end if;
  delete from public.photos p where p.participant_id = v_participant_id
    and p.idempotency_key = p_idempotency_key and p.status = 'pending';
end;
$$;
revoke all on function public.release_shot_by_capture(uuid, text, text) from public, anon, authenticated;
grant execute on function public.release_shot_by_capture(uuid, text, text) to service_role;

drop function if exists public.event_guest_state(text, text);

create function public.event_guest_state(p_slug text, p_token_hash text)
returns table (
  id uuid, slug text, event_name text, cover_path text, host_name text,
  time_zone text, locale text, capture_start_at timestamptz,
  capture_end_at timestamptz, reveal_mode public.reveal_mode,
  reveal_at timestamptz, shots_per_participant smallint,
  guests_can_view boolean, participant_id uuid, display_name text,
  can_capture boolean, can_guest_view_gallery boolean,
  shots_remaining integer, participant_limit_reached boolean,
  photo_count integer, post_event_uploads_enabled boolean
)
language sql stable security definer set search_path = '' as $$
  select e.id, e.slug, e.event_name, e.cover_path,
    (u.raw_user_meta_data ->> 'full_name'), e.time_zone, e.locale,
    e.capture_start_at, e.capture_end_at, e.reveal_mode, e.reveal_at,
    e.shots_per_participant, e.guests_can_view, p.id, p.display_name,
    (p.id is not null and now() >= e.capture_start_at and now() <= e.capture_end_at),
    (e.guests_can_view and now() >= e.reveal_at),
    case when p.id is null then e.shots_per_participant::integer
      else greatest(e.shots_per_participant - public.participant_shots_used(p.id), 0) end,
    (p.id is null and not public.event_is_full_plan(e.id)
      and public.event_participant_count_capped(e.id, public.free_participant_limit())
        >= public.free_participant_limit()),
    coalesce(c.photo_count, 0)::integer, e.post_event_uploads_enabled
  from public.events e
  join auth.users u on u.id = e.owner_id
  left join public.participants p
    on p.event_id = e.id and p.session_token_hash = p_token_hash
  left join lateral (
    select count(*) as photo_count from public.photos ph
    where ph.event_id = e.id and ph.status = 'ready' and ph.hidden_at is null
  ) c on true
  where e.slug = p_slug
$$;

-- The token hash is the guest's whole identity, so an `anon` grant would make
-- an observed hash enough to read someone's state. Server code only.
revoke all on function public.event_guest_state(text, text) from public, anon, authenticated;
grant execute on function public.event_guest_state(text, text) to service_role;
