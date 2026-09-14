-- The locked gallery, as a wall of tiles that have not developed yet.
--
-- Before the reveal a guest used to read one sentence — the photos are still
-- developing — over an album that looked, as far as the page could show,
-- empty. The whole tension of the format is that the roll is filling up while
-- nobody can look, and a wall of unreadable tiles says that where a sentence
-- cannot.
--
-- What a tile may carry is the design. `event_gallery_by_slug` withholds every
-- path until the reveal, and the bucket is public, so a path — or a photo id,
-- beside the event id the page already holds — would be the photo itself. This
-- returns neither:
--
--   uploader_name  the participant's display name, as the gallery shows it
--   tile_seed      32 bits of md5(photo id), for the tile's gradient; nothing
--                  that leads back to the id
--   total_count    every row the filter matched, counted before the limit
--
-- Rows only while `now() < reveal_at` — the exact complement of the gallery's
-- clause, so the two never answer at once — and none while the host keeps
-- guests out, because that lock is a decision rather than a wait. Hidden and
-- uncommitted frames are left out for the same reasons the gallery leaves them
-- out. Newest 24: a locked album does not need six hundred tiles to make its
-- point, and the count says how many more.
--
-- Granted like `event_gallery_by_slug`: keyed on the slug, which is the lock,
-- and returning less than that function does after the reveal.

create function public.event_developing_gallery_by_slug(p_slug text)
returns table (
  uploader_name text,
  tile_seed     integer,
  total_count   integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select pa.display_name as uploader_name,
         ('x' || substr(md5(p.id::text), 1, 8))::bit(32)::integer as tile_seed,
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
  'The reveal-locked gallery as tiles: uploader name, a hashed seed and the total. Never an id or a path.';

revoke all on function public.event_developing_gallery_by_slug(text) from public;
grant execute on function public.event_developing_gallery_by_slug(text) to anon, authenticated, service_role;
