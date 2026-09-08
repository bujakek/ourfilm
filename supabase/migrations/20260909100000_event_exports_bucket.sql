-- The bucket finished album archives land in.
--
-- Private, unlike `event-photos`: a ZIP of a whole wedding is the one object
-- whose address must not be a permanent public URL. The host reaches it
-- through a signed download URL minted by their own page, bounded by the
-- export's expiry, and the object is deleted 48 hours after it was made.
--
-- RLS on `storage.objects` is untouched and there is no policy for this
-- bucket at all: nothing reads it under a session. The worker writes through a
-- signed upload token (`createSignedUploadUrl`, the same call the guest photo
-- path uses), Vercel reads metadata and mints download URLs with the service
-- role, and the sweep deletes with the service role. No listing, no anon, no
-- host access to the bucket itself.
--
-- `file_size_limit` is the platform's ceiling for a resumable upload, 50GB,
-- rather than a guess at the largest album. A 2 000-photo wedding at today's
-- 2MB masters is ~4GB and the worst realistic case — an older event with 4MB
-- masters and thousands of photos — is ~20GB, so any number in between would
-- have been a cap that only ever refuses a legitimate export while buying
-- almost nothing on a bug: a runaway worker writes many objects, not one big
-- one, and the sweep is what catches those. The project-wide upload limit
-- (Project Settings → Storage) caps every bucket regardless of this value and
-- has to be raised by hand on the hosted project; locally,
-- `supabase/config.toml`'s `[storage] file_size_limit` is the same ceiling.
--
-- `allowed_mime_types` is null on purpose. The worker uploads `application/zip`
-- and Storage would refuse `application/x-zip-compressed`, which some tus
-- clients send; the object's own content type is set by the uploader either
-- way and nothing downstream branches on it.
insert into storage.buckets (id, name, public, file_size_limit)
values ('event-exports', 'event-exports', false, 53687091200)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;
