-- A colour sketch of each photo for the reveal-locked wall.
--
-- Before the reveal a tile has been a wash of the palette seeded from the
-- photo id, because nothing about the photo may reach a guest early: the
-- bucket is public, so a path is the photo, and a CSS blur over a real
-- thumbnail is undone by opening the image in a new tab.
--
-- A ThumbHash is the exception that holds. The uploading phone computes it
-- from the image it has already decoded — about 25 bytes of low-frequency
-- colour and layout, rendered as a ~32px image — and there is no detail in it
-- to recover: no face, no text, nothing a guest could not already guess from
-- being in the room. It is not a path and leads to none.
--
-- `photos.sketch` is base64, and optional everywhere: photos from before this
-- migration, a resume that never decoded the master, and a phone whose canvas
-- refused all leave it null, and the wall falls back to the seeded wash.

alter table public.photos
  add column sketch text
  constraint photos_sketch_length check (char_length(sketch) <= 64);

-- `commit_shot` takes it as a seventh, defaulted argument, so a server still
-- calling with six names keeps working through a deploy.
drop function public.commit_shot(uuid, text, integer, integer, integer, timestamptz);

create function public.commit_shot(
  p_photo_id   uuid,
  p_token_hash text,
  p_width      integer,
  p_height     integer,
  p_byte_size  integer,
  p_taken_at   timestamptz,
  p_sketch     text default null
)
returns table (shots_remaining integer, committed boolean, refusal text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_photo public.photos%rowtype;
  v_shots smallint;
begin
  select p.* into v_photo
  from public.photos p
  join public.participants pa on pa.id = p.participant_id
  where p.id = p_photo_id
    and pa.session_token_hash = p_token_hash;

  if not found then
    return query select 0, false, 'not_matched'::text;
    return;
  end if;

  perform 1 from public.participants pa where pa.id = v_photo.participant_id for update;

  select e.shots_per_participant into v_shots
  from public.events e where e.id = v_photo.event_id;

  -- Re-read under the lock: a concurrent commit of the same row may have
  -- finished while this one waited.
  select p.* into v_photo from public.photos p where p.id = p_photo_id;

  if v_photo.status::text = 'pending'
    and coalesce(v_photo.reserved_at, v_photo.created_at)
      <= now() - public.shot_reservation_ttl()
    and public.participant_shots_used(v_photo.participant_id) >= v_shots
  then
    return query select 0, false, 'no_shots'::text;
    return;
  end if;

  update public.photos p
     set status    = 'ready',
         width     = p_width,
         height    = p_height,
         byte_size = p_byte_size,
         taken_at  = p_taken_at,
         -- Kept from an earlier commit when a replay has none: a resume that
         -- skipped the decode has nothing to sketch from. A malformed one is
         -- dropped rather than refused — the photo matters, its sketch not.
         sketch    = coalesce(
           case when p_sketch ~ '^[A-Za-z0-9+/]{8,62}={0,2}$' then p_sketch end,
           p.sketch
         )
   where p.id = p_photo_id;

  return query select
    greatest(v_shots - public.participant_shots_used(v_photo.participant_id), 0),
    true,
    null::text;
end;
$$;

revoke all on function public.commit_shot(uuid, text, integer, integer, integer, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.commit_shot(uuid, text, integer, integer, integer, timestamptz, text)
  to service_role;

-- The wall gains the sketch. Still never an id or a path; see
-- `20260914120000_developing_gallery.sql` for what a tile may carry and why.
drop function public.event_developing_gallery_by_slug(text);

create function public.event_developing_gallery_by_slug(p_slug text)
returns table (
  uploader_name text,
  tile_seed     integer,
  sketch        text,
  total_count   integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select pa.display_name as uploader_name,
         ('x' || substr(md5(p.id::text), 1, 8))::bit(32)::integer as tile_seed,
         p.sketch,
         (count(*) over ())::integer as total_count
  from public.photos p
  join public.events e on e.id = p.event_id
  join public.participants pa on pa.id = p.participant_id
  where e.slug = p_slug
    and p.hidden_at is null
    and p.status = 'ready'
    and e.guests_can_view
    and now() < e.reveal_at
  order by p.created_at desc
  limit 24
$$;

comment on function public.event_developing_gallery_by_slug(text) is
  'The reveal-locked gallery as tiles: uploader name, a hashed seed, a ThumbHash sketch and the total. Never an id or a path.';

revoke all on function public.event_developing_gallery_by_slug(text) from public;
grant execute on function public.event_developing_gallery_by_slug(text) to anon, authenticated, service_role;
