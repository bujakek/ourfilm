-- A host can delete one photo, and the row survives it.
--
-- The counterpart of `scripts/takedown-photo.ts`, which has been the operator's
-- lever since the bucket went public: remove the three renders, keep the row,
-- set `hidden_at`. This makes it a host-facing action, and the row surviving is
-- not a detail — it is the whole reason the shape is legal.
--
-- **`participant_shots_used` counts photo rows.** Delete the row and the frame
-- comes back, which would make deleting a way for a host to hand a guest more
-- film and would quietly falsify "no retakes" on the landing page. A tombstone
-- keeps `status = 'ready'`, so the count is unchanged and the frame stays
-- spent. That is the property this column exists to protect.
--
-- Nothing else in the schema has to change, and that is worth stating because
-- it looks too cheap. Every guest-facing reader already gates on
-- `hidden_at is null` — `event_gallery_by_slug`, `my_frames`,
-- `event_guest_state`, `owned_events_with_previews` — and the delete sets it.
-- What `deleted_at` adds is the distinction those readers do not need and the
-- host's own two do: the moderation grid and the album export read the table
-- directly and deliberately include hidden photos, so they are the only places
-- that must now say `deleted_at is null`. Both are in `apps/web/lib`
-- (`getAllEventPhotos`, `loadExportPhotos`), which means this migration is
-- inert on its own and safe to apply ahead of the deploy.
--
-- No index. The two queries that read it are already `event_id = ? and
-- status = 'ready'`, which `photos_event_idx` covers; a partial index here
-- would earn nothing on an album of a few hundred rows.

alter table public.photos
  add column deleted_at timestamptz;

comment on column public.photos.deleted_at is
  'When a host permanently deleted this photo. The three storage objects are gone; the row stays so the frame it spent stays spent (`participant_shots_used` counts rows). `hidden_at` is set alongside it, which is what removes it from every guest surface. Read it in `getAllEventPhotos` and `loadExportPhotos`; nothing else needs to.';
