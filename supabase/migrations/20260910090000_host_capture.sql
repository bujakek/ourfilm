-- Host capture: the organiser shoots without leaving the host area.
--
-- A photo has to belong to a participant — `photos.participant_id` is not null
-- precisely so that every frame has spent somebody's film — so a host who takes
-- a picture becomes a participant of their own event. What they do not get is a
-- guest's credential: the participant cookie is path-scoped to `/e/<slug>`
-- (see `lib/participants.ts`), and a Server Action posts to the path of the
-- page that owns it, so nothing under `/host` ever receives it.
--
-- Rather than widening that cookie's path or issuing a second one, the host is
-- recognised by the session they already hold. `user_id` links the participant
-- row to `auth.users`, the server resolves it from `auth.uid()` after checking
-- ownership, and the row's `session_token_hash` is random and never leaves the
-- server. Deriving that hash from the user id was considered and rejected: the
-- guest path hashes whatever raw token is in the cookie, and `httpOnly` stops
-- JavaScript rather than the person holding the browser, so a derivable hash
-- would let anyone who learned a host's user id present themselves as that
-- host.

alter table public.participants
  add column user_id uuid references auth.users (id) on delete set null;

comment on column public.participants.user_id is
  'The signed-in account this participant is, when there is one. Today that is only the event''s own host, shooting from /host/events/<slug>; a guest is anonymous and leaves it null. Every guest count in this schema reads `user_id is null`, so revisit all of them before this column holds anything else.';

-- One participant row per account per event, so a double-tapped shutter, two
-- tabs and a reloaded page all land on the roll the host already has.
create unique index participants_user_idx
  on public.participants (event_id, user_id)
  where user_id is not null;

-- ---------------------------------------------------------------------------
-- The host is not a guest, and the free cap counts guests.
--
-- Three counts, all of them now `user_id is null`. Without this a free event
-- would drop from five guests to four the moment the couple took one photo of
-- their own wedding — and the guest turned away at the door would have no way
-- to find out why.
-- ---------------------------------------------------------------------------

create or replace function public.event_participant_count_capped(p_event_id uuid, p_cap integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from (
    select 1
    from public.participants p
    where p.event_id = p_event_id
      and p.user_id is null
    limit p_cap
  ) capped
$$;

create or replace function public.event_participant_quota(p_event_id uuid)
returns table (
  participant_limit integer,
  participant_count integer,
  unlimited         boolean,
  plan_source       text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.free_participant_limit(),
    (select count(*)::integer from public.participants p
      where p.event_id = p_event_id and p.user_id is null),
    src.source is not null,
    src.source
  from (select public.event_plan_source(p_event_id) as source) src
$$;

create or replace function public.owned_events_with_previews()
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
      and pt.user_id is null
  ) pc on true
  order by e.created_at desc
$$;

-- ---------------------------------------------------------------------------
-- The host's own roll.
--
-- The counterpart of `join_event`, and deliberately not the same function: a
-- guest is admitted by a token and counted against a cap, and a host is
-- admitted by owning the event and counted against nothing. Sharing one
-- function would mean one body with two access models in it.
--
-- It does not re-derive ownership, exactly as `join_event` does not check who
-- is calling. What makes that safe is the grant below plus the caller: the only
-- code that reaches this has already read the event through the host's own
-- RLS-scoped session, which is the ownership check.
--
-- The `on conflict` returns the existing row untouched apart from its name, so
-- the token hash a first call minted is the one every later call gets back. A
-- rotating hash would strand a `commit_shot` that was issued against the
-- previous one.
-- ---------------------------------------------------------------------------

create or replace function public.host_participant(
  p_event_id   uuid,
  p_user_id    uuid,
  p_name       text,
  p_token_hash text
)
returns table (participant_id uuid, token_hash text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := left(nullif(btrim(p_name), ''), 40);
  if v_name is null then
    raise exception 'A név nem lehet üres.' using errcode = 'check_violation';
  end if;

  return query
  insert into public.participants (event_id, display_name, session_token_hash, user_id)
  values (p_event_id, v_name, p_token_hash, p_user_id)
  on conflict (event_id, user_id) where user_id is not null
    do update set last_seen_at = now(), display_name = excluded.display_name
  returning public.participants.id, public.participants.session_token_hash;
end;
$$;

-- Service role only, by name. `revoke ... from public` leaves Supabase's direct
-- grants to anon and authenticated in place — the lesson
-- 20260825080000_lock_down_capture_rpcs.sql exists for — and this function
-- mints a participant on any event it is handed.
revoke all on function public.host_participant(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.host_participant(uuid, uuid, text, text) to service_role;
