import 'server-only'

import { createAdminClient } from './supabase/admin'
import { PHOTO_BUCKET } from './storage'

/**
 * The capture path: reserve a frame, hand back somewhere to put it, commit it.
 *
 * Three steps rather than one, because the shot limit has to be atomic and the
 * upload cannot be. Holding a database transaction open across a 2MB PUT on
 * venue wifi is not a thing to do; reserving the frame first, uploading
 * second, and committing third gets the same guarantee with the lock held for
 * microseconds.
 *
 * No photo bytes pass through here. `reserve` returns signed upload URLs and
 * the browser PUTs straight to Supabase Storage, which is what keeps this
 * compatible with Vercel's request model — the server actions carry only small
 * JSON.
 */

// Signed upload URLs expire on Supabase's own schedule (two hours) and the API
// exposes no way to shorten it. That is comfortably longer than any upload on
// venue wifi, and the token is bound to one exact path the database has already
// agreed to — so a leaked one buys nothing but the ability to fill a frame the
// guest had already claimed.

export type ShotRefusal =
  | 'no_session'
  | 'not_started'
  | 'ended'
  | 'no_shots'
  | 'rate_limited'
  | 'uploads_disabled'
  | 'storage_limit'
  | 'error'

export type ReservedShot = {
  photoId: string
  shotsRemaining: number
  uploads: {
    full: SignedUpload
    view: SignedUpload
    thumb: SignedUpload
  }
}

export type SignedUpload = { path: string; token: string }

export type ReserveResult =
  { ok: true; shot: ReservedShot } | { ok: false; refusal: ShotRefusal }

/**
 * Reserve one frame and mint somewhere to put its three renders.
 *
 * `idempotencyKey` is minted once per shutter press by the client and reused
 * across retries, so a guest tapping "Újra" on a failed upload gets the same
 * frame back instead of spending another one. The uniqueness is enforced by an
 * index, not by this function.
 */
export async function reserveShot({
  eventId,
  tokenHash,
  idempotencyKey,
}: {
  eventId: string
  tokenHash: string
  idempotencyKey: string
}): Promise<ReserveResult> {
  const db = createAdminClient()

  const { data, error } = await db
    .rpc('reserve_shot', {
      p_event_id: eventId,
      p_token_hash: tokenHash,
      p_idempotency_key: idempotencyKey,
    })
    .maybeSingle()

  if (error) throw error
  if (!data) return { ok: false, refusal: 'error' }
  if (data.refusal) return { ok: false, refusal: data.refusal as ShotRefusal }

  const paths = {
    full: data.storage_path as string,
    view: data.view_path as string,
    thumb: data.thumb_path as string,
  }

  // Signed one at a time because that is the only shape the API offers for
  // uploads. Concurrently, because three sequential round trips to Storage
  // before the guest can start sending anything is latency they would feel.
  const [full, view, thumb] = await Promise.all([
    signUpload(db, paths.full),
    signUpload(db, paths.view),
    signUpload(db, paths.thumb),
  ])

  return {
    ok: true,
    shot: {
      photoId: data.photo_id as string,
      shotsRemaining: data.shots_remaining,
      uploads: { full, view, thumb },
    },
  }
}

async function signUpload(
  db: ReturnType<typeof createAdminClient>,
  path: string,
): Promise<SignedUpload> {
  const { data, error } = await db.storage
    .from(PHOTO_BUCKET)
    .createSignedUploadUrl(path, { upsert: true })

  if (error) throw error
  // The generated type allows a null path, though a successful call always
  // carries one. Failing here rather than shipping an undefined path keeps a
  // storage bug from surfacing as a silently missing photo.
  if (!data?.path || !data.token) {
    throw new Error(`Could not sign an upload URL for ${path}`)
  }
  return { path: data.path, token: data.token }
}

/**
 * Commit a frame whose renders are in Storage.
 *
 * Returns the authoritative remaining count. The camera UI renders whatever
 * this says and never its own arithmetic — a client-side counter is a display,
 * and this is the number.
 */
export async function commitShot({
  photoId,
  tokenHash,
  width,
  height,
  byteSize,
  takenAt,
}: {
  photoId: string
  tokenHash: string
  width: number
  height: number
  byteSize: number
  takenAt: string | null
}): Promise<{ committed: boolean; shotsRemaining: number }> {
  const db = createAdminClient()

  const { data, error } = await db
    .rpc('commit_shot', {
      p_photo_id: photoId,
      p_token_hash: tokenHash,
      p_width: width,
      p_height: height,
      p_byte_size: byteSize,
      // The generator types every function argument as non-nullable, but this
      // one genuinely takes null: a native camera file does not always carry a
      // readable EXIF timestamp, and those photos fall back to `created_at`.
      p_taken_at: takenAt as string,
    })
    .maybeSingle()

  if (error) throw error
  if (!data) return { committed: false, shotsRemaining: 0 }

  return { committed: data.committed, shotsRemaining: data.shots_remaining }
}

/**
 * Hand a frame back after a failed upload.
 *
 * Best effort, and never awaited into anything's correctness: the reservation
 * expires on its own after ten minutes, so this only makes the common case
 * immediate. Swallows its own errors for the same reason — a guest whose upload
 * just failed is about to retry, and a second error message about the cleanup
 * of the first helps nobody.
 */
export async function releaseShot({
  photoId,
  tokenHash,
}: {
  photoId: string
  tokenHash: string
}): Promise<void> {
  try {
    const db = createAdminClient()
    await db.rpc('release_shot', {
      p_photo_id: photoId,
      p_token_hash: tokenHash,
    })
  } catch (e) {
    console.error('Could not release reserved shot', e)
  }
}
