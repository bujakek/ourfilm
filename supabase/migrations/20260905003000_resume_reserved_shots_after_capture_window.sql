-- Let an already-reserved camera frame finish after the capture window closes.
--
-- A guest may press the shutter while the camera is open and lose connectivity
-- before the three Storage uploads complete. The client retries with the same
-- idempotency key. Checking the event window before that key used to reject the
-- retry as `ended`, even though the database had already accepted the frame.
-- New keys still have to be inside the window; only an existing reservation is
-- replayed after it.
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

  -- The reservation is the server-side proof that this shutter press happened
  -- while capture was allowed. Replay it before applying the window to new work.
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
  if now() > v_event.capture_end_at then
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

-- Supabase grants functions to API roles directly. Reassert the capture
-- boundary whenever this function is replaced.
revoke all on function public.reserve_shot(uuid, text, text) from public;
revoke all on function public.reserve_shot(uuid, text, text)
  from anon, authenticated;
grant execute on function public.reserve_shot(uuid, text, text) to service_role;
