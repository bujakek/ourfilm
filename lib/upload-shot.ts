import 'client-only'

import type { PreparedPhoto } from './image'
import { PHOTO_BUCKET } from './storage'
import { createGuestClient } from './supabase/client'
import { retryTransfer } from './upload-retry'

/** One signed slot, as `reserve_shot`'s action handed it back. */
export type SignedUpload = { path: string; token: string }

/**
 * Put one captured frame's three renders into Storage.
 *
 * Every path here was minted by `reserve_shot` inside the transaction that
 * spent the guest's shot, and each signed token is valid for that one path and
 * nothing else. So the browser cannot choose where its bytes land, cannot write
 * to another event's folder, and cannot write at all without having first been
 * granted a frame. That is what replaced the old anon insert policy on
 * `storage.objects`.
 *
 * All three go up together. Sequentially, the ~40KB thumbnail would wait on a
 * whole round trip behind the ~2MB master — pure latency, once per photo, on
 * the highest-latency network the product will ever run on. The lightbox render
 * is ~250KB and rides along in the window the master already occupies.
 *
 * Each render retries on its own, not the shot as a whole. When the ~40KB
 * thumbnail landed and the ~2MB master died, retrying per render re-sends 2MB
 * instead of 2.3MB — which on the network this runs over is the entire point.
 * It also keeps `onProgress` monotonic: the fraction only counts renders that
 * have actually landed, and a whole-call retry would have to walk it backwards.
 * Only transient failures repeat; see `lib/upload-retry.ts` for what counts.
 *
 * Throws on any failure. The caller releases the reservation and offers a
 * retry; nothing is committed, so a failed upload costs the guest no frame.
 */
export async function uploadShotRenders({
  prepared,
  uploads,
  onProgress,
}: {
  prepared: PreparedPhoto
  uploads: { full: SignedUpload; view: SignedUpload; thumb: SignedUpload }
  /**
   * Called with the fraction of the shot's bytes that have landed, weighted by
   * render size, as each render completes.
   *
   * Three coarse steps rather than a byte-level readout: `uploadToSignedUrl`
   * goes through `fetch`, which reports no upload progress at all, and the
   * alternative is hand-rolling the signed-URL request over XHR to get a
   * number that only feeds an animation. The renders differ in size by nearly
   * two orders of magnitude, so weighting by bytes makes those three steps
   * land roughly where the time goes — the ~40KB thumbnail early, the ~2MB
   * master last.
   */
  onProgress?: (fraction: number) => void
}): Promise<void> {
  const supabase = createGuestClient()

  const renders = [
    [uploads.full, prepared.full],
    [uploads.view, prepared.view],
    [uploads.thumb, prepared.thumb],
  ] as const

  const total = renders.reduce((sum, [, body]) => sum + body.size, 0)
  let landed = 0

  const puts = await Promise.all(
    renders.map(([slot, body]) =>
      // The `catch` matters as much as the retry. `Promise.all` rejects the
      // moment any member does, so a terminal failure on the master would
      // abandon the other two mid-retry — unhandled rejections and requests
      // nobody is waiting on. Collecting the error and throwing it below keeps
      // the original shape: every put settles, then the first failure wins.
      retryTransfer(async () => {
        const result = await supabase.storage
          .from(PHOTO_BUCKET)
          .uploadToSignedUrl(slot.path, slot.token, body, {
            contentType: 'image/jpeg',
            cacheControl: '31536000',
          })
        // `uploadToSignedUrl` returns its failure rather than throwing it, and
        // p-retry only ever sees a throw.
        if (result.error) throw result.error
        landed += body.size
        onProgress?.(total > 0 ? landed / total : 1)
        return result
      }).catch((error: unknown) => ({ error })),
    ),
  )

  for (const { error } of puts) {
    if (error) throw error
  }
}
