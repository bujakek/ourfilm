-- Optional photo-library uploads after the disposable camera closes.
--
-- This deliberately spends the guest's original roll rather than granting a
-- second allowance. A guest who used every frame during the event gets none
-- afterwards; a guest with eight left may add eight. That keeps the storage
-- ceiling and the product's fixed-roll promise identical on both sides of the
-- capture end.

alter table public.events
  add column after_event_uploads_enabled boolean not null default false;

comment on column public.events.after_event_uploads_enabled is
  'When true, guests who joined before capture_end_at may spend their remaining frames on photo-library uploads until capture_end_at + 24 hours.';

-- The guest page needs both the host's setting and whether this participant
-- existed before closing. Returning only a momentary `can_upload` boolean
-- would be false during the event and could never turn true in a page left
-- open across the boundary.
drop function if exists public.event_guest_state(text, text);

create function public.event_guest_state(p_slug text, p_token_hash text)
returns table (
  id uuid, slug text, event_name text, cover_path text, host_name text,
  time_zone text, locale text, capture_start_at timestamptz,
  capture_end_at timestamptz, reveal_mode public.reveal_mode,
  reveal_at timestamptz, shots_per_participant smallint,
  guests_can_view boolean, after_event_uploads_enabled boolean,
  after_event_upload_eligible boolean, participant_id uuid, display_name text,
  can_capture boolean, can_guest_view_gallery boolean,
  shots_remaining integer, participant_limit_reached boolean,
  photo_count integer
)
language sql stable security definer set search_path = '' as $$
  select e.id, e.slug, e.event_name, e.cover_path,
    (u.raw_user_meta_data ->> 'full_name'), e.time_zone, e.locale,
    e.capture_start_at, e.capture_end_at, e.reveal_mode, e.reveal_at,
    e.shots_per_participant, e.guests_can_view,
    e.after_event_uploads_enabled,
    (e.after_event_uploads_enabled and p.id is not null
      and p.user_id is null and p.joined_at <= e.capture_end_at),
    p.id, p.display_name,
    (p.id is not null and now() >= e.capture_start_at and now() <= e.capture_end_at),
    (e.guests_can_view and now() >= e.reveal_at),
    case when p.id is null then e.shots_per_participant::integer
      else greatest(e.shots_per_participant - public.participant_shots_used(p.id), 0) end,
    (p.id is null and not public.event_is_full_plan(e.id)
      and public.event_participant_count_capped(e.id, public.free_participant_limit())
        >= public.free_participant_limit()),
    coalesce(c.photo_count, 0)::integer
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

revoke all on function public.event_guest_state(text, text)
  from public, anon, authenticated;
grant execute on function public.event_guest_state(text, text) to service_role;

-- Carry the setting through the host list RPC too. It is not rendered there
-- today, but every returned event has the same complete OwnedEvent shape and
-- callers must not silently invent a default for this setting.
drop function if exists public.owned_events_with_previews();

create function public.owned_events_with_previews()
returns table (
  id                    uuid,
  slug                  text,
  event_name            text,
  cover_path            text,
  time_zone             text,
  locale                text,
  capture_start_at      timestamptz,
  capture_end_at        timestamptz,
  reveal_mode           public.reveal_mode,
  reveal_at             timestamptz,
  shots_per_participant smallint,
  guests_can_view       boolean,
  after_event_uploads_enabled boolean,
  created_at            timestamptz,
  photo_count           integer,
  participant_count     integer,
  is_full_plan          boolean,
  previews              text[]
)
language sql
stable
set search_path = ''
as $$
  select
    e.id, e.slug, e.event_name, e.cover_path, e.time_zone, e.locale,
    e.capture_start_at, e.capture_end_at,
    e.reveal_mode, e.reveal_at,
    e.shots_per_participant, e.guests_can_view,
    e.after_event_uploads_enabled, e.created_at,
    coalesce(c.photo_count, 0)::integer,
    coalesce(pc.participant_count, 0)::integer,
    public.event_is_full_plan(e.id),
    coalesce(c.previews, array[]::text[])
  from public.events e
  left join lateral (
    select count(*) as photo_count,
           (array_agg(t.thumb_path order by t.created_at desc))[1:8] as previews
    from public.photos t
    where t.event_id = e.id
      and t.hidden_at is null
      and t.status = 'ready'
  ) c on true
  left join lateral (
    select count(*) as participant_count
    from public.participants pt
    where pt.event_id = e.id
      and pt.user_id is null
  ) pc on true
  order by e.created_at desc
$$;

revoke all on function public.owned_events_with_previews() from public, anon;
grant execute on function public.owned_events_with_previews() to authenticated;

-- A fifth argument identifies the UI surface that supplied the file. It is
-- not a security claim — a browser can label a picked file however it likes —
-- but the fixed roll remains the abuse ceiling either way. Its purpose is to
-- apply the after-event setting without weakening the existing native-camera
-- grace for a file captured before close and uploaded afterwards.
create function public.reserve_shot(
  p_event_id           uuid,
  p_token_hash         text,
  p_idempotency_key    text,
  p_capture_started_at timestamptz,
  p_source             text
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

  -- Replay before checking the window. An existing reservation is stronger
  -- evidence than either a client timestamp or the source label.
  select * into v_existing
  from public.photos p
  where p.participant_id = v_participant.id
    and p.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.status::text = 'pending' then
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

  if p_source is null or p_source not in ('camera', 'library') then
    return query select null::uuid, null::text, null::text, null::text, 0, 'ended', null::integer, null::integer,
      null::text, null::bigint, null::bigint, null::bigint;
    return;
  end if;

  if p_source = 'library' then
    -- Library selection is an after-event affordance, never a second shutter
    -- while the camera is running. Late joiners may view a revealed album but
    -- cannot acquire a roll that did not exist during the event.
    if now() <= v_event.capture_end_at
      or not v_event.after_event_uploads_enabled
      or now() > v_event.capture_end_at + public.shot_upload_grace()
      or v_participant.user_id is not null
      or v_participant.joined_at > v_event.capture_end_at
    then
      return query select null::uuid, null::text, null::text, null::text, 0, 'ended', null::integer, null::integer,
        null::text, null::bigint, null::bigint, null::bigint;
      return;
    end if;
  elsif now() > v_event.capture_end_at and (
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

  v_used := public.participant_shots_used(v_participant.id);

  if v_used >= v_event.shots_per_participant then
    return query select null::uuid, null::text, null::text, null::text, 0, 'no_shots', null::integer, null::integer,
      null::text, null::bigint, null::bigint, null::bigint;
    return;
  end if;

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

revoke all on function public.reserve_shot(uuid, text, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.reserve_shot(uuid, text, text, timestamptz, text)
  to service_role;

-- Existing deployments and the host camera continue to use this signature.
-- It is now a camera-labelled wrapper so there remains one reservation body.
create or replace function public.reserve_shot(
  p_event_id           uuid,
  p_token_hash         text,
  p_idempotency_key    text,
  p_capture_started_at timestamptz
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
language sql
volatile
security definer
set search_path = ''
as $$
  select * from public.reserve_shot(
    p_event_id, p_token_hash, p_idempotency_key, p_capture_started_at, 'camera'
  )
$$;

revoke all on function public.reserve_shot(uuid, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.reserve_shot(uuid, text, text, timestamptz)
  to service_role;

-- The three-argument rolling-deploy wrapper still calls the four-argument
-- function and keeps its existing service-role-only grants.
