-- Idempotent event creation.
--
-- The create flow can now be filled in signed out, which puts an auth round
-- trip between "Létrehozás" and the insert. Everything about that round trip
-- invites a second attempt at the same event: the host taps twice, reloads the
-- callback URL, has the magic link open in a second tab, or comes back to a
-- resume route that runs on mount. A disabled button in the browser closes none
-- of those — they are separate requests, and two of them are separate page
-- loads.
--
-- So the browser mints one key per draft and sends it with the create, and this
-- index is what makes a repeat a no-op instead of a duplicate album. Scoped to
-- the owner rather than global: the key comes from the client, and a global
-- unique would let anyone stop someone else creating an event by guessing or
-- replaying theirs.
--
-- Nullable, and the index is partial. Existing rows have no key, and neither
-- will anything created by a path that has no draft behind it — a NULL is
-- "this was not a resumable creation" rather than a missing value, and NULLs
-- do not collide in a unique index anyway.
alter table public.events
  add column if not exists creation_key uuid;

create unique index if not exists events_owner_creation_key_idx
  on public.events (owner_id, creation_key)
  where creation_key is not null;

comment on column public.events.creation_key is
  'Client-minted per-draft key. Makes a repeated create from the same owner a '
  'no-op rather than a duplicate event — see app/admin/events/new/actions.ts.';
