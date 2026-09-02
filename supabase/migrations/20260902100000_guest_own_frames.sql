-- A guest's own roll, so scarcity can be seen instead of described.
--
-- The film strip on the guest event page draws one cell per frame the host's
-- roll length allows and fills the exposed ones with that guest's own
-- thumbnails. No existing read answers that question: `event_gallery_by_slug`
-- is reveal-gated and returns *everyone's* photos, and the host-side read goes
-- straight at the table under ownership RLS.
--
-- **A guest's own frames are deliberately not reveal-gated.** The reveal exists
-- so the group sees the night together, not to withhold your own shots from
-- you — and a roll you cannot see is precisely the thing this screen exists to
-- stop being invisible. It does not loosen the gallery by a row:
-- `event_gallery_by_slug` keeps its `now() >= e.reveal_at` clause untouched,
-- and this is a separate, narrower read that can only ever return frames
-- belonging to the caller's own participant.
--
-- Three constraints hold that narrowness, and all three are load-bearing:
--
--   1. **The token hash is the only authorisation.** The participant is looked
--      up *from* the hash and never taken as an argument — a client-supplied
--      participant id would turn this into a way to read anyone's roll, and a
--      slug identifies an event, not a person.
--   2. **`thumb_path` only.** A strip cell is 52px. There is no reason for this
--      endpoint to be able to hand out the 4096px master, so it cannot.
--   3. **`service_role` only**, like every other read keyed on a session token.
--      `revoke … from public` does not achieve that — Supabase grants execute
--      to `anon` and `authenticated` directly — so both are revoked by name.
--      See `20260825080000_lock_down_capture_rpcs.sql`, which exists because a
--      test caught exactly that omission on `reserve_shot`.
create or replace function public.my_frames(
  p_event_id   uuid,
  p_token_hash text
)
returns table (
  frame_index int,
  thumb_path  text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    row_number() over (order by p.created_at, p.id)::int as frame_index,
    -- A hidden photo still spent the frame, so its cell stays exposed and keeps
    -- its number — it simply has nothing to show. `hidden_at` is the host
    -- saying "not in the album", and the guest who took it is not an exception
    -- to that; but dropping the row outright would report a shorter roll than
    -- `participant_shots_used` counts, which deliberately counts hidden photos
    -- so that hiding cannot become a way to shoot forever.
    case when p.hidden_at is null then p.thumb_path end as thumb_path
  from public.photos p
  where p.status = 'ready'
    -- An empty or unknown hash matches no participant, so the subquery is null
    -- and the comparison returns no rows. A guest who has not joined takes the
    -- same code path as one presenting a wrong token, which is the property
    -- `readParticipantTokenHash()` is shaped to preserve on the caller's side.
    and p.participant_id = (
      select pa.id
      from public.participants pa
      where pa.event_id = p_event_id
        and pa.session_token_hash = p_token_hash
    )
  order by p.created_at, p.id
$$;

revoke all on function public.my_frames(uuid, text) from public;
revoke all on function public.my_frames(uuid, text) from anon, authenticated;
grant execute on function public.my_frames(uuid, text) to service_role;
