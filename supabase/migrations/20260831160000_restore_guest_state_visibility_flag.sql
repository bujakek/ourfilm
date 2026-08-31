-- Restore `guests_can_view` to `event_guest_state`.
--
-- `20260831120000_event_locale.sql` recreated this function to add `locale` and
-- dropped two columns while doing it. `capture_open` had no readers and stays
-- gone, but `guests_can_view` does: it is the difference between the two
-- reasons a gallery can be shut.
--
-- `can_guest_view_gallery` is `guests_can_view and now() >= reveal_at`, so a
-- guest looking at a closed gallery cannot tell from it whether the host
-- switched guest access off or the photos are simply still developing.
-- `galleryLock()` in `lib/event-copy.ts` says something different in each case,
-- and `guestGalleryIsOpen()` in `lib/camera.ts` takes the raw flag. The
-- collapsed boolean cannot answer either.

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
  photo_count integer
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

-- The token hash is the guest's whole identity, so an `anon` grant would make
-- an observed hash enough to read someone's state. Server code only.
revoke all on function public.event_guest_state(text, text) from public, anon, authenticated;
grant execute on function public.event_guest_state(text, text) to service_role;
