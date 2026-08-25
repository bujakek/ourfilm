import 'client-only'

import type { PreparedPhoto } from './image'
import { PHOTO_BUCKET } from './storage'
import { createGuestClient } from './supabase/client'

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
 * Throws on any failure. The caller releases the reservation and offers a
 * retry; nothing is committed, so a failed upload costs the guest no frame.
 */
export async function uploadShotRenders({
  prepared,
  uploads,
}: {
  prepared: PreparedPhoto
  uploads: { full: SignedUpload; view: SignedUpload; thumb: SignedUpload }
}): Promise<void> {
  const supabase = createGuestClient()

  const puts = await Promise.all(
    (
      [
        [uploads.full, prepared.full],
        [uploads.view, prepared.view],
        [uploads.thumb, prepared.thumb],
      ] as const
    ).map(([slot, body]) =>
      supabase.storage
        .from(PHOTO_BUCKET)
        .uploadToSignedUrl(slot.path, slot.token, body, {
          contentType: 'image/jpeg',
          cacheControl: '31536000',
        }),
    ),
  )

  for (const { error } of puts) {
    if (error) throw error
  }
}
