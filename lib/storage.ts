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
 * The event's cover image. One per event, overwritten in place when the host
 * changes it — there is no history to keep and a stable path means nothing has
 * to remember the old one to delete it.
 */
export function coverStoragePath(eventId: string) {
  return `${eventId}/cover.jpg`
}
