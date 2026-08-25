-- Actually revoke the guest write RPCs from `anon`.
--
-- `revoke all on function … from public` does not do it. Supabase grants
-- execute to `anon` and `authenticated` **directly**, not only through PUBLIC,
-- so revoking from PUBLIC leaves the direct grants untouched and the function
-- wide open. This repo has hit it before —
-- `20260818172146_restrict_admin_event_previews.sql` exists for the same
-- reason, on `owned_events_with_previews`.
--
-- Verified against the remote before writing this: `join_event`,
-- `reserve_shot`, `commit_shot`, `release_shot` and `event_guest_state` were
-- all callable with the anon key, which ships in the browser bundle.
--
-- That mattered more here than it did last time. The whole point of putting the
-- participant session in an httpOnly cookie is that the page cannot read the
-- token and therefore cannot spend somebody's film by hand. A `reserve_shot`
-- reachable with the anon key gives that back: a token hash is presentable but
-- not secret once observed, and anyone holding one could claim frames directly,
-- skipping the server action entirely. `join_event` was worse in a quieter way
-- — anyone could burn an event's five free participant slots from a script.
--
-- These four are reachable only from server actions, which are the only things
-- that hold the cookie. `service_role` is the audience; nothing else.

revoke all on function public.join_event(text, text, text)
  from anon, authenticated;
revoke all on function public.reserve_shot(uuid, text, text)
  from anon, authenticated;
revoke all on function public.commit_shot(uuid, text, integer, integer, integer, timestamptz)
  from anon, authenticated;
revoke all on function public.release_shot(uuid, text)
  from anon, authenticated;

-- Read path, same reasoning: it takes a session token hash and returns that
-- participant's own name and remaining shot count. Fetched by Server Components
-- through the service role.
revoke all on function public.event_guest_state(text, text)
  from anon, authenticated;

-- The host's own dashboard number. `authenticated` keeps it — RLS is not what
-- scopes this one, but a signed-in user learning a participant count for an
-- event id they already have is not a leak worth a round trip to avoid.
revoke all on function public.event_participant_quota(uuid) from anon;

-- Deliberately untouched: `event_gallery_by_slug` stays granted to
-- `anon, authenticated`. It is the one guest read that needs no session — it
-- carries the reveal check in its own `where` clause, so calling it directly
-- before the reveal returns nothing.
