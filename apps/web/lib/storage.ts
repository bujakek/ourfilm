export const PHOTO_BUCKET = 'event-photos'

/**
 * The one place the storage layout is defined.
 *
 * Every RLS policy on `storage.objects` reads the event id out of the first
 * path segment, so a stray path shape does not fail loudly — it fails as a
 * permission denial that looks like a broken upload. Build paths here and
 * nowhere else.
 *
 * Photo paths are also built inside `reserve_shot`, which is what actually
 * writes them onto the row. These two spellings have to agree; this one exists
 * for the cover image and for tests.
 */
export function photoStoragePaths(eventId: string, photoId: string) {
  return {
    full: `${eventId}/${photoId}.jpg`,
    thumb: `${eventId}/${photoId}_thumb.jpg`,
    view: `${eventId}/${photoId}_view.jpg`,
  }
}

/**
 * The event's cover image, versioned by a fresh id per upload.
 *
 * It was a stable `{eventId}/cover.jpg`, overwritten in place, while reads
 * were signed and every render minted a fresh URL. On a public bucket the URL
 * is the cache key, and an object overwritten under the same key keeps serving
 * the old bytes from the CDN for as long as the cache header allows. A new id
 * per upload is a new URL, so a replaced cover appears the moment the
 * `cover_path` write lands; the caller deletes the old object afterwards.
 *
 * Events created before September 2026 keep their `cover.jpg`; nothing reads
 * the filename, only the column.
 */
export function coverStoragePath(eventId: string, coverId: string) {
  return `${eventId}/cover-${coverId}.jpg`
}
