import 'server-only'

import { PHOTO_BUCKET } from './storage'
import { createAdminClient } from './supabase/admin'

/**
 * Signed read URLs for photos.
 *
 * The bucket is private. It used to be public, and privacy came from the two
 * unguessable uuids in the path — a fair bet for an album with no reveal, and
 * an untenable one now. A public object URL keeps working forever regardless of
 * what the reveal predicate says, so the promise "nobody sees these until the
 * album is developed" could not have been kept by a URL anyone could hold.
 *
 * Signing is therefore not a detail of how images load; it is where the reveal
 * is enforced for the bytes themselves. Only server code that has already
 * decided a viewer is entitled calls in here.
 *
 * One batch call per grid rather than one per tile: `createSignedUrls` takes an
 * array, and a gallery of 200 photos must not be 200 round trips. Pages that
 * use this are already `force-dynamic`, so a fresh signature per render costs
 * nothing extra.
 */

/** An hour. Long enough that a guest can scroll, open a photo and pinch around
 *  without a link going stale mid-session; short enough that a URL pasted
 *  somewhere else stops working the same afternoon. */
const READ_TTL_SECONDS = 60 * 60

/**
 * Sign many paths at once.
 *
 * Returns a lookup rather than an array so callers index by the path they
 * already hold, and a path that failed to sign is simply absent — the caller
 * skips that tile instead of rendering a broken image. Duplicates are collapsed
 * before signing; the grid and the lightbox often want the same object.
 */
export async function signPhotoUrls(
  paths: readonly (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))]
  const signed = new Map<string, string>()
  if (unique.length === 0) return signed

  const db = createAdminClient()
  const { data, error } = await db.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(unique, READ_TTL_SECONDS)

  if (error) throw error

  for (const entry of data ?? []) {
    // `createSignedUrls` reports per-path failures inside the array rather than
    // rejecting, so an object that has gone missing must not take the whole
    // gallery down with it.
    if (entry.error || !entry.signedUrl || !entry.path) continue
    signed.set(entry.path, entry.signedUrl)
  }

  return signed
}

/** One path. Convenience for the cover image, which is never part of a batch. */
export async function signPhotoUrl(
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null
  const signed = await signPhotoUrls([path])
  return signed.get(path) ?? null
}
