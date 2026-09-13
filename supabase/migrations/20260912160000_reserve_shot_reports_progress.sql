-- Tell a replayed reservation how far its last attempt got.
--
-- A capture is reserve → three PUTs → commit, and a retry used to repeat all
-- of it: decode the master again, send all three renders again, commit again.
-- The device cannot do better on its own. The endings that matter are answers
-- it never received — a PUT that landed after the browser's timeout, a commit
-- that went through while its response was lost — so only the server knows
-- where the photo really stopped, and now it says:
--
--   photo_status                        'pending' | 'ready'. A ready row needs
--                                       nothing more from the device.
--   full_bytes, view_bytes, thumb_bytes the size Storage holds for each render,
--                                       null where there is no object.
--
-- Storage is consulted only on a replay of a pending row. A row this call
-- inserted cannot have objects yet, a ready row does not need them, and a
-- refusal has no row: all four are null there.
--
-- Only `bucket_id`, `name` and `metadata` are read from storage.objects, and
-- by (bucket_id, name), which its unique index serves. A plpgsql body is not
-- checked until it runs, so a column the hosted storage schema lacks would
-- break every reservation in production rather than fail this migration.
--
-- The return type grows, which `create or replace` refuses, so the
-- four-argument function is dropped and recreated. The three-argument wrapper
-- selects its columns by name and is left as it is.

drop function if exists public.reserve_shot(uuid, text, text, timestamptz);

create function public.reserve_shot(
  p_event_id          uuid,
  p_token_hash        text,
  p_idempotency_key   text,
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
    if v_existing.status::text = 'pending' then
      select
        max((o.metadata ->> 'size')::bigint) filter (where o.name = v_existing.storage_path),
        max((o.metadata ->> 'size')::bigint) filter (where o.name = v_existing.view_path),
        max((o.metadata ->> 'size')::bigint) filter (where o.name = v_existing.thumb_path)
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
  if now() > v_event.capture_end_at then
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

-- A dropped function loses its grants, and Supabase grants a new one to the
-- API roles directly. Reassert the boundary by name.
revoke all on function public.reserve_shot(uuid, text, text, timestamptz) from public;
revoke all on function public.reserve_shot(uuid, text, text, timestamptz)
  from anon, authenticated;
grant execute on function public.reserve_shot(uuid, text, text, timestamptz)
  to service_role;
