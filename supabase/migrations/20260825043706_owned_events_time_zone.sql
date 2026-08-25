-- `owned_events_with_previews`, plus the event's timezone.
--
-- The admin list renders each event's capture window and reveal, and a
-- `timestamptz` needs a zone to render. Without this column the list would fall
-- back to Europe/Budapest and quietly show a host the wrong clock for an event
-- they deliberately set up in another one.
--
-- Dropped and recreated rather than replaced: a `returns table` cannot gain a
-- column via `create or replace`.

drop function if exists public.owned_events_with_previews();

create function public.owned_events_with_previews()
returns table (
  id                    uuid,
  slug                  text,
  event_name            text,
  cover_path            text,
  time_zone             text,
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
    e.id, e.slug, e.event_name, e.cover_path, e.time_zone,
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
