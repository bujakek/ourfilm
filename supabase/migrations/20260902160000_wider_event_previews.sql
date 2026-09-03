-- Eight preview thumbnails per event, and whether each one is still capped.
--
-- The host dashboard's rows become contact sheets: a strip of thumbnails
-- bleeding to the card's edge, eight across, with an overflow cell last. Four
-- previews would leave that strip half empty, which reads as a loading state
-- rather than as a sheet.
--
-- `is_full_plan` comes with it, because the list also has to show which events
-- have stopped admitting guests. The row already carries `participant_count`,
-- but a count alone cannot answer that: comparing it against
-- `free_participant_limit()` would put "keret betelt" on paid and admin-owned
-- events, which are exactly the ones that are not capped. The predicate is the
-- only honest source, and it is the same one `join_event` enforces with.
--
-- **Carried forward from `20260831120000_event_locale.sql`, not from the
-- original definition**: `time_zone` and `locale` were added to this function
-- after it was first written, so recreating it from the older shape silently
-- dropped both. Every caller reads them — the list would have rendered
-- deadlines in the wrong zone and linked guests to the wrong language.
--
-- Still SECURITY INVOKER, and still deliberately: a definer function here would
-- quietly become a way to read every event in the system. See
-- `20260818172146_restrict_admin_event_previews.sql`.
-- Dropped and recreated rather than replaced: adding a column changes the row
-- type defined by the OUT parameters, and Postgres refuses that in a
-- `create or replace` (42P13). The grants below are re-issued for the same
-- reason — a dropped function takes its privileges with it.
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
    e.shots_per_participant, e.guests_can_view, e.created_at,
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
  ) pc on true
  order by e.created_at desc
$$;

revoke all on function public.owned_events_with_previews() from public, anon;
grant execute on function public.owned_events_with_previews() to authenticated;

