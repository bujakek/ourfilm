-- `event_guest_state`, with two fields the guest screens turned out to need.
--
-- `guests_can_view` — the host's raw switch, not the resolved permission. The
-- gallery has to tell two closed states apart: "still developing", which is a
-- wait, and "only the organizer sees these", which is a decision. Collapsing
-- them would leave a guest refreshing all evening for an album that is never
-- going to open. It leaks nothing: that sentence is exactly what we show them.
--
-- `capture_open` — whether the window is open, independent of whether *this*
-- caller has joined. `can_capture` deliberately requires a participant, so the
-- join screen, which by definition has none, could not use it to decide whether
-- its button says "Kamera megnyitása" or just "Csatlakozom".
--
-- Dropped and recreated rather than replaced: a `returns table` cannot gain a
-- column via `create or replace`.

drop function if exists public.event_guest_state(text, text);

create function public.event_guest_state(
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
  guests_can_view          boolean,
  capture_open             boolean,
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
    e.guests_can_view,
    (now() >= e.capture_start_at and now() <= e.capture_end_at) as capture_open,
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

revoke all on function public.event_guest_state(text, text) from public;
grant execute on function public.event_guest_state(text, text) to service_role;
