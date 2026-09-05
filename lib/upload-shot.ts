import 'client-only'

import type { PreparedPhoto } from './image'
import { PHOTO_BUCKET } from './storage'
import { createGuestClient } from './supabase/client'

export type SignedUpload = { path: string; token: string }

/**
 * PUT the three renders to the signed URLs `reserve_shot` minted.
 *
 * Parallel: the thumbnail would otherwise wait a round trip behind the master.
 * Not retried here — the queue replays the whole capture with a fresh reserve.
 * `signal` aborts the PUTs when the queue's upload timeout fires.
 */
export async function uploadShotRenders({
  prepared,
  uploads,
  onProgress,
  signal,
}: {
  prepared: PreparedPhoto
  uploads: { full: SignedUpload; view: SignedUpload; thumb: SignedUpload }
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}): Promise<void> {
  const supabase = createGuestClient(
    signal ? (input, init) => fetch(input, { ...init, signal }) : undefined,
  )

  const renders = [
    [uploads.full, prepared.full],
    [uploads.view, prepared.view],
    [uploads.thumb, prepared.thumb],
  ] as const

  const total = renders.reduce((sum, [, body]) => sum + body.size, 0)
  let landed = 0

  const puts = await Promise.all(
    renders.map(([slot, body]) =>
      supabase.storage
        .from(PHOTO_BUCKET)
        .uploadToSignedUrl(slot.path, slot.token, body, {
          contentType: 'image/jpeg',
          cacheControl: '31536000',
        })
        .then((result) => {
          if (!result.error) {
            landed += body.size
            onProgress?.(total > 0 ? landed / total : 1)
          }
          return result
        })
        .catch((error: unknown) => ({ error })),
    ),
  )

  for (const { error } of puts) {
    if (error) throw error
  }
}
