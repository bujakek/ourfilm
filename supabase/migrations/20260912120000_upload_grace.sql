-- Let a shot that started before the camera closed reserve its database row
-- after capture_end_at.
--
-- A native camera hands the browser its File only after the OS camera UI
-- returns. The tab can then spend minutes offline or be killed before the
-- queue reaches reserve_shot. An existing reservation already replays after
-- the window (20260905003000); this migration covers the earlier gap.
--
-- There is no cryptographic way for a web server to prove when an offline
-- native-camera shutter fired: every timestamp available after reconnect is
-- supplied by the device. The boundary is therefore deliberately layered:
--
-- 1. the ordinary UI stops opening the camera at capture_end_at;
-- 2. a guest participant must already have existed before capture_end_at;
-- 3. the client reports when that native-camera hand-off started;
-- 4. the server accepts that claim only when it falls inside the event window
--    and the request itself arrives within this fixed grace period;
-- 5. the participant's immutable roll length remains the hard upper bound.
--
-- Twenty-four hours matches the client queue's maximum age. A forged time can
-- spend an existing participant's remaining frames late, but cannot create a
-- fresh guest roll or keep an event writable indefinitely.
create or replace function public.shot_upload_grace()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '24 hours' $$;

revoke all on function public.shot_upload_grace() from public;
revoke all on function public.shot_upload_grace() from anon, authenticated;

create or replace function public.reserve_shot(
  p_event_id          uuid,
  p_token_hash        text,
  p_idempotency_key   text,
  p_capture_started_at timestamptz
)
returns table (
  photo_id         uuid,
  storage_path     text,
  view_path        text,
  thumb_path       text,
  shots_remaining integer,
  refusal          text
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

  -- A reservation is stronger server-side evidence than any client timestamp.
  -- Replay it before applying either the capture window or the upload grace.
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

  if now() < v_event.capture_start_at then
    return query select null::uuid, null::text, null::text, null::text, 0, 'not_started';
    return;
  end if;

  -- While the camera is open, server time is the only clock that matters. Once
  -- it closes, a new reservation needs both an in-window device claim and an
  -- arrival inside the bounded upload grace period.
  if now() > v_event.capture_end_at and (
    now() > v_event.capture_end_at + public.shot_upload_grace()
    or p_capture_started_at is null
    or p_capture_started_at < v_event.capture_start_at
    or p_capture_started_at > v_event.capture_end_at
    -- Guest joins stay available after the event so a new viewer can enter a
    -- revealed gallery. That must not also mint a late roll. The host row is
    -- exempt: it is created lazily on the host's first reserve call, after the
    -- action has already proved event ownership.
    or (v_participant.user_id is null and v_participant.joined_at > v_event.capture_end_at)
  ) then
    return query select null::uuid, null::text, null::text, null::text, 0, 'ended';
    return;
  end if;

  v_used := public.participant_shots_used(v_participant.id);

  if v_used >= v_event.shots_per_participant then
    return query select null::uuid, null::text, null::text, null::text, 0, 'no_shots';
    return;
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
    null::text;
end;
$$;

-- Keep the old signature during a rolling deployment. Old clients still obey
-- the server's live window because their missing capture claim is represented
-- by now(); only the new four-argument call can use the grace period.
create or replace function public.reserve_shot(
  p_event_id        uuid,
  p_token_hash      text,
  p_idempotency_key text
)
returns table (
  photo_id         uuid,
  storage_path     text,
  view_path        text,
  thumb_path       text,
  shots_remaining integer,
  refusal          text
)
language sql
volatile
security definer
set search_path = ''
as $$
  select *
  from public.reserve_shot(
    p_event_id,
    p_token_hash,
    p_idempotency_key,
    now()
  )
$$;

-- Supabase grants functions to API roles directly. Reassert the boundary for
-- both overloads: only server actions holding the participant cookie may call.
revoke all on function public.reserve_shot(uuid, text, text, timestamptz) from public;
revoke all on function public.reserve_shot(uuid, text, text, timestamptz)
  from anon, authenticated;
grant execute on function public.reserve_shot(uuid, text, text, timestamptz)
  to service_role;

revoke all on function public.reserve_shot(uuid, text, text) from public;
revoke all on function public.reserve_shot(uuid, text, text)
  from anon, authenticated;
grant execute on function public.reserve_shot(uuid, text, text) to service_role;
