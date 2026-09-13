import 'client-only'

import type { RenderKind } from './upload-resume'
import { PHOTO_BUCKET } from './storage'
import { createGuestClient } from './supabase/client'

export type SignedUpload = { path: string; token: string }

/** One render and the signed slot `reserve_shot` minted for it. */
export type RenderUpload = { kind: RenderKind; slot: SignedUpload; body: Blob }

/**
 * PUT the renders a capture still needs to the signed URLs `reserve_shot`
 * minted — all three on a first attempt, only the missing ones on a retry that
 * found the others in Storage (see `lib/upload-resume.ts`).
 *
 * Parallel: the thumbnail would otherwise wait a round trip behind the master.
 * Not retried here — the queue replays the capture with a fresh reserve.
 * `signal` aborts the PUTs when the queue's upload timeout fires.
 */
export async function uploadShotRenders({
  renders,
  onProgress,
  signal,
}: {
  renders: readonly RenderUpload[]
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}): Promise<void> {
  const supabase = createGuestClient(
    signal ? (input, init) => fetch(input, { ...init, signal }) : undefined,
  )

  const total = renders.reduce((sum, { body }) => sum + body.size, 0)
  let landed = 0

  const puts = await Promise.all(
    renders.map(({ slot, body }) =>
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
