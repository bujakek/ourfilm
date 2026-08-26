import 'server-only'

import { PHOTO_BUCKET } from './storage'
import type { createAdminClient } from './supabase/admin'

/**
 * Erasing one event's objects from Storage, verified at every step.
 *
 * Extracted from the host's delete action so the retention run cannot get it
 * subtly wrong in a second copy. The subtlety is the whole reason it is here:
 *
 * - **Collect every path first, remove second.** Deleting inside the paging
 *   loop shifts the offsets out from under it and skips whole pages.
 * - **A short page is not the end.** The Storage API is free to return fewer
 *   objects than asked for; treating that as "done" is the bug that left
 *   albums half-deleted, with the surviving objects orphaned and the only
 *   record of them about to be cascaded away.
 * - **`remove()` reports what it deleted and silently omits what it could
 *   not.** The count is the only signal that a path survived.
 *
 * Anything doubtful throws, and the caller must then leave the database rows
 * in place — they are the only remaining record of which objects exist.
 * Erasure that half-succeeds is worse than erasure that fails, because the
 * host is told the photos are gone.
 *
 * Deliberately storage-only: which client deletes the *rows*, and under whose
 * authorization, is the caller's decision. The host's own delete runs on their
 * session under ownership RLS; the retention run has no session at all.
 */

/** One page of a Storage listing. `list()` returns a page, not a total. */
const LIST_PAGE = 100

/** Bound on the paging loop. 20k objects is an order of magnitude past any
 *  real album, so reaching it means `offset` is not advancing rather than that
 *  someone shot ten thousand photos. Treated as a failure, never as "done". */
const MAX_LIST_PAGES = 200

/** `remove()` carries every path in one request body, so a large album goes in
 *  batches rather than a single enormous call. */
const REMOVE_BATCH = 100

/** Structural, so the host's typed client and the compliance client both fit:
 *  Storage is not schema-generic, so the two share one implementation. */
type SupabaseStorage = ReturnType<typeof createAdminClient>['storage']

export async function purgeEventObjects(
  storage: SupabaseStorage,
  eventId: string,
): Promise<{ removed: number }> {
  const bucket = storage.from(PHOTO_BUCKET)

  const paths: string[] = []
  let listingComplete = false

  for (let page = 0; page < MAX_LIST_PAGES; page++) {
    const { data: listed, error } = await bucket.list(eventId, {
      limit: LIST_PAGE,
      offset: paths.length,
      // Explicit, so the ordering the offsets index into cannot change between
      // one page and the next.
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw error

    if (!listed || listed.length === 0) {
      listingComplete = true
      break
    }
    paths.push(...listed.map((object) => `${eventId}/${object.name}`))
  }

  if (!listingComplete) {
    throw new Error('Nem sikerült végigolvasni a képeket. Próbáld újra.')
  }

  for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
    const batch = paths.slice(i, i + REMOVE_BATCH)
    const { data: removed, error } = await bucket.remove(batch)
    if (error) throw error
    if (!removed || removed.length !== batch.length) {
      throw new Error('Nem sikerült minden képet törölni. Próbáld újra.')
    }
  }

  // Capture may still be open, so a guest can land a photo between the listing
  // above and the rows going. Confirm the folder is empty instead of assuming
  // it — this is the last moment at which an object left behind is still
  // findable.
  const { data: leftover, error: leftoverError } = await bucket.list(eventId, {
    limit: 1,
  })
  if (leftoverError) throw leftoverError
  if (leftover && leftover.length > 0) {
    throw new Error('Közben új kép érkezett. Indítsd újra a törlést.')
  }

  return { removed: paths.length }
}
