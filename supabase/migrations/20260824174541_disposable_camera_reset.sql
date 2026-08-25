-- The disposable camera pivot: schema reset.
--
-- OurFilm stops being a shared photo album and becomes a private digital
-- disposable camera. A host creates one camera per event; guests join by QR or
-- link, give a name, and get a fixed roll of shots. The camera works only
-- inside a capture window, and the host decides when the photos are developed.
--
-- This is a **clean reset**, not a migration. The product is pre-launch: the
-- only rows here were the owner's own test data, and their storage objects were
-- removed immediately before this ran. There is deliberately no legacy mode, no
-- `capture_mode` discriminator and no dual code path — every event from here on
-- uses the new model, and the old album shape is gone rather than deprecated.
--
-- Preserved on purpose: auth.users, public.profiles (including the two admin
-- rows — dropping those would revoke the operator's own admin exemption),
-- public.purchases and public.stripe_webhook_events. The billing model is
-- unchanged; only the entitlement it grants moves from photos to participants.

-- ---------------------------------------------------------------------------
-- Data reset
-- ---------------------------------------------------------------------------

-- Cascades public.photos. Storage objects for these events were removed first;
-- doing it in this order would have cascaded away the only record of which
-- objects existed.
delete from public.events;

-- ---------------------------------------------------------------------------
-- Drop what the old model needed
-- ---------------------------------------------------------------------------

-- The two guest write policies go entirely. Guests no longer hold any direct
-- write access to Postgres or Storage: every capture is a server action calling
-- a service-role RPC, which is what makes the per-participant shot limit
-- something a hand-rolled fetch cannot walk around.
drop policy if exists "guests add photos while uploads are open" on public.photos;

-- Dropped here rather than with the rest of the bucket change, because the
-- policy expression references `event_folder_accepts_uploads` and Postgres
-- refuses to drop a function a live policy depends on.
drop policy if exists "guests upload into an open event folder" on storage.objects;

-- Read RPCs and gate functions, all superseded. Dropped rather than replaced
-- because every one of them changes signature.
drop function if exists public.event_by_slug(text);
drop function if exists public.event_page_by_slug(text);
drop function if exists public.event_photos(uuid);
drop function if exists public.event_gallery_by_slug(text);
drop function if exists public.event_accepts_uploads(uuid);
drop function if exists public.event_folder_accepts_uploads(text);
drop function if exists public.event_upload_quota(uuid);
drop function if exists public.event_within_photo_limit(uuid);
drop function if exists public.event_photo_count_capped(uuid, integer);
drop function if exists public.event_has_unlimited_uploads(uuid);
drop function if exists public.free_photo_limit();
drop function if exists public.owned_events_with_previews();

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

-- How the reveal moment is chosen. Stored alongside the resolved instant rather
-- than instead of it: the mode is what the UI needs to say ("a galéria a
-- fotózás végén nyílik meg"), the instant is what every permission check reads.
create type public.reveal_mode as enum ('instant', 'event_end', 'custom');

-- A capture is reserved before its bytes exist and committed once they land.
-- The pending state is what makes the shot limit atomic without holding a
-- transaction open across an upload.
create type public.photo_status as enum ('pending', 'ready');

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------

alter table public.events
  -- Legacy. `event_date` was already documented as write-nothing, and
  -- `gallery_hidden_at` is replaced by the reveal instant plus `guests_can_view`
  -- — a manual on/off switch cannot express "opens at 22:00".
  drop column event_date,
  drop column gallery_hidden_at;

alter table public.events
  rename column uploads_close_at to capture_end_at;

alter table public.events
  add column capture_start_at timestamptz,
  -- The IANA zone name, kept beside the UTC instants rather than derived from
  -- them. An offset is not a zone: +02:00 cannot tell you what the host meant
  -- for a window that straddles a DST boundary, and every rendered date has to
  -- read back in the zone the host typed it in.
  add column time_zone text not null default 'Europe/Budapest',
  add column reveal_mode public.reveal_mode not null default 'event_end',
  add column reveal_at timestamptz,
  -- The roll of film. Constrained to the five offered values so a hand-crafted
  -- PATCH cannot set 9999; the default is what the create form recommends.
  add column shots_per_participant smallint not null default 24,
  add column guests_can_view boolean not null default true,
  add column cover_path text,
  add column updated_at timestamptz not null default now();

-- Both instants are required now. They were nullable only because the old model
-- let an album stay open forever, which is the behaviour this replaces.
update public.events set capture_start_at = created_at where capture_start_at is null;
update public.events set capture_end_at = created_at where capture_end_at is null;
update public.events set reveal_at = capture_end_at where reveal_at is null;

alter table public.events
  alter column capture_start_at set not null,
  alter column capture_end_at   set not null,
  alter column reveal_at        set not null;

alter table public.events
  add constraint events_capture_window_check
    check (capture_end_at > capture_start_at),
  add constraint events_shots_per_participant_check
    check (shots_per_participant in (5, 10, 16, 24, 36)),
  -- Only the custom mode can name its own moment, and it may not land before
  -- the camera stops. The other two modes are pinned by the trigger below, so
  -- this only ever constrains what a host actually chose.
  add constraint events_reveal_at_check
    check (reveal_mode <> 'custom' or reveal_at >= capture_end_at);

comment on column public.events.time_zone is
  'IANA zone the host chose. Capture and reveal instants are UTC; this is how they are rendered back.';
comment on column public.events.reveal_at is
  'Resolved reveal instant for all three modes. Maintained by events_resolve_reveal_at().';
comment on column public.events.cover_path is
  'Storage path of the cover image, {event_id}/cover.jpg. Null renders the fallback.';

-- ---------------------------------------------------------------------------
-- The reveal instant is materialised, never computed per read
-- ---------------------------------------------------------------------------

-- Two modes are definitionally tied to the capture window, so they are resolved
-- on write and every reader is a plain `now() >= reveal_at`. The alternative —
-- a CASE expression in each of the half-dozen places that ask — is how one
-- caller ends up disagreeing with the others about whether an album is open.
--
-- It also means moving `capture_end_at` on an `event_end` event moves the
-- reveal with it, without any caller remembering to.
--
-- Nothing here schedules anything. The gallery opens because a request arrives
-- after `reveal_at`, which is the only mechanism Vercel can offer without a
-- background worker.
create or replace function public.events_resolve_reveal_at()
returns trigger
language plpgsql
as $$
begin
  new.reveal_at := case new.reveal_mode
    when 'instant'   then new.capture_start_at
    when 'event_end' then new.capture_end_at
    -- An early reveal writes both columns together, so a custom mode that
    -- arrives without an instant is a caller bug rather than something to
    -- paper over with a default.
    else coalesce(new.reveal_at, new.capture_end_at)
  end;
  new.updated_at := now();
  return new;
end;
$$;

create trigger events_resolve_reveal_at
  before insert or update on public.events
  for each row execute function public.events_resolve_reveal_at();

-- ---------------------------------------------------------------------------
-- participants
-- ---------------------------------------------------------------------------

-- The thing the old schema had no room for. `photos.uploader_name` was free
-- text — a label, never an identity — so there was nothing to hang a per-guest
-- roll of film on, and two guests typing the same name were the same person.
--
-- Identity is a random token in an httpOnly cookie. Only its SHA-256 is stored,
-- so a database dump is not a set of usable session keys, and the raw token
-- never leaves the server action that mints it.
create table public.participants (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null references public.events (id) on delete cascade,
  display_name       text not null,
  session_token_hash text not null,
  joined_at          timestamptz not null default now(),
  last_seen_at       timestamptz not null default now()
);

-- Doubles as the resume path and the double-submit guard: joining is an upsert
-- on this key, so a guest who refreshes, reopens the link a week later, or taps
-- the button twice keeps the one participant row they already had.
create unique index participants_session_idx
  on public.participants (event_id, session_token_hash);
create index participants_event_idx on public.participants (event_id);

alter table public.participants enable row level security;
revoke all on public.participants from anon;

-- No anon policy at all, matching events: anything anon can select through
-- PostgREST, anyone with the anon key can list — and that would hand out every
-- guest's name at every event. Guests reach their own row only through the
-- security-definer RPCs, keyed on a token they must already hold.
create policy "host reads participants in own events"
  on public.participants for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.events e
      where e.id = participants.event_id and e.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- photos
-- ---------------------------------------------------------------------------

alter table public.photos
  -- Every photo now belongs to a participant. Not nullable and not optional:
  -- an unattributed photo is one that consumed nobody's shot, which is the
  -- shape of row a limit-bypass would leave behind.
  add column participant_id uuid not null references public.participants (id) on delete cascade,
  add column status public.photo_status not null default 'pending',
  -- Minted once per shutter press and reused across retries, so a guest tapping
  -- "Újra" on a flaky connection re-reserves the same row instead of burning a
  -- second shot.
  add column idempotency_key text,
  -- Superseded by participants.display_name. Keeping both would let the two
  -- disagree, and the join is what makes a name an identity.
  drop column uploader_name;

create unique index photos_participant_idempotency_idx
  on public.photos (participant_id, idempotency_key)
  where idempotency_key is not null;

create index photos_participant_idx on public.photos (participant_id);

-- What `reserve_shot` counts. Bounded by participant and status so the check on
-- the busiest path in the product is an index scan of at most 36 tuples.
create index photos_participant_status_idx
  on public.photos (participant_id, status, created_at);

comment on column public.photos.status is
  'pending = reserved, bytes may still be uploading. ready = committed. Only the guest gallery reads ready rows.';
comment on column public.photos.idempotency_key is
  'Per-shutter-press key. Retrying a failed upload with the same key returns the same reservation.';
