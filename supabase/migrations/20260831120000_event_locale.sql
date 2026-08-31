-- Event language is part of the event, not a browser preference. Existing
-- events predate the English flow and were created for the Hungarian product,
-- while newly inserted rows default to the global English experience.
alter table public.events add column locale text;
update public.events set locale = 'hu';
alter table public.events alter column locale set default 'en';
alter table public.events alter column locale set not null;
alter table public.events
  add constraint events_locale_check check (locale in ('en', 'hu'));

drop function if exists public.event_guest_state(text, text);

create function public.event_guest_state(p_slug text, p_token_hash text)
returns table (
  id uuid, slug text, event_name text, cover_path text, host_name text,
  time_zone text, locale text, capture_start_at timestamptz,
  capture_end_at timestamptz, reveal_mode public.reveal_mode,
  reveal_at timestamptz, shots_per_participant smallint,
  participant_id uuid, display_name text, can_capture boolean,
  can_guest_view_gallery boolean, shots_remaining integer,
  participant_limit_reached boolean, photo_count integer
)
language sql stable security definer set search_path = '' as $$
  select e.id, e.slug, e.event_name, e.cover_path,
    (u.raw_user_meta_data ->> 'full_name'), e.time_zone, e.locale,
    e.capture_start_at, e.capture_end_at, e.reveal_mode, e.reveal_at,
    e.shots_per_participant, p.id, p.display_name,
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

revoke all on function public.event_guest_state(text, text) from public, anon, authenticated;
grant execute on function public.event_guest_state(text, text) to service_role;

drop function if exists public.owned_events_with_previews();

create function public.owned_events_with_previews()
returns table (
  id uuid, slug text, event_name text, cover_path text, time_zone text,
  locale text, capture_start_at timestamptz, capture_end_at timestamptz,
  reveal_mode public.reveal_mode, reveal_at timestamptz,
  shots_per_participant smallint, guests_can_view boolean, created_at timestamptz,
  photo_count integer, participant_count integer, previews text[]
)
language sql stable set search_path = '' as $$
  select e.id, e.slug, e.event_name, e.cover_path, e.time_zone, e.locale,
    e.capture_start_at, e.capture_end_at, e.reveal_mode, e.reveal_at,
    e.shots_per_participant, e.guests_can_view, e.created_at,
    coalesce(c.photo_count, 0)::integer,
    coalesce(pc.participant_count, 0)::integer,
    coalesce(c.previews, array[]::text[])
  from public.events e
  left join lateral (
    select count(*) as photo_count,
      (array_agg(t.thumb_path order by t.created_at desc))[1:4] as previews
    from public.photos t
    where t.event_id = e.id and t.hidden_at is null and t.status = 'ready'
  ) c on true
  left join lateral (
    select count(*) as participant_count from public.participants pt
    where pt.event_id = e.id
  ) pc on true
  order by e.created_at desc
$$;

revoke all on function public.owned_events_with_previews() from public, anon;
grant execute on function public.owned_events_with_previews() to authenticated;
