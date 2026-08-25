-- Close the photo bucket.
--
-- The reveal is the product now: a host promises their guests that nobody sees
-- the photos until the album is developed. A public bucket cannot keep that
-- promise. `/object/public/…` serves files without consulting RLS at all, so an
-- object URL obtained by any means — a guest's own upload, a shared screenshot,
-- a CDN cache — keeps working no matter what the reveal predicate says. The
-- gate would be a UI state rather than a property of the system.
--
-- So the bucket goes private and every read is signed by the server, which is
-- already the only place that knows whether the reveal has happened.
--
-- The other half of the same change: guests no longer write to Storage at all.
-- The insert policy below is dropped because captures now upload to a signed
-- URL minted by `reserve_shot`'s server action, which means an upload can only
-- land on a path the database has already agreed to.
update storage.buckets
   set public = false
 where id = 'event-photos';

-- The anon insert policy and `event_folder_accepts_uploads` both went in the
-- reset migration — the policy expression depended on the function, so they had
-- to be dropped together. Nothing anonymous writes here any more.

-- The host/admin policy is unchanged and is now the only one on this bucket.
-- Note there is still deliberately no select policy for anon: a select policy
-- governs *listing*, and one scoped to the bucket would let anyone call
-- POST /storage/v1/object/list/event-photos and walk every event id and photo
-- id in the system. Signed URLs are minted by the service role and need no
-- policy of their own.
