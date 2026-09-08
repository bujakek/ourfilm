import { publicSupabaseEnv } from './supabase/env'
import { PHOTO_BUCKET } from './storage'

/**
 * Photo URLs.
 *
 * The bucket is public, and a photo's URL is a pure function of its storage
 * path: no signature, no expiry, no round trip to Storage, and the same string
 * for every viewer. That last part is the point. A signed URL carries its token
 * in the query, so every render minted an address no other guest's cache could
 * hit; a public URL is one cache key per object for the whole wedding.
 *
 * What this module deliberately is not: an authorization layer. Which paths a
 * guest is ever told about is decided by the reveal-gated RPCs
 * (`event_gallery_by_slug`, `my_frames`) and by ownership RLS on the host side.
 * A URL built here is only as private as the path it was built from, and the
 * path is two unguessable uuids that nothing anonymous can enumerate — there is
 * no anon `select` policy on `storage.objects`, so the bucket cannot be listed.
 *
 * It was private, and reads were signed, until September 2026. Signing bought
 * one thing: revoking an address already handed out, bounded by the hour-long
 * TTL. It cost a Storage round trip on every grid, a URL per viewer, and a
 * broken image whenever a signature expired mid-session. See
 * `docs/public-cdn-and-export-worker.md` for the trade in full.
 *
 * No `server-only` marker, on purpose: nothing here needs a secret, and the
 * browser-side album download planned for Phase 2 builds the same URLs.
 */

/**
 * The public URL of one stored object.
 *
 * Always returns a string. A path whose object has gone missing yields a URL
 * that 404s, which the grid renders as a broken tile and reports as
 * `gallery_image_failed` — visible, rather than silently absent as it was when
 * a failed signature simply dropped the photo.
 */
export function publicPhotoUrl(path: string): string {
  const { url } = publicSupabaseEnv()
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  return `${url}/storage/v1/object/public/${PHOTO_BUCKET}/${encoded}`
}
