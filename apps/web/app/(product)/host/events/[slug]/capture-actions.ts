'use server'

import { revalidatePath } from 'next/cache'

import { releaseShot, reserveShot, type ShotRefusal } from '@/lib/capture'
import {
  type CommitShotAnswer,
  liveCommitDeps,
  observeCommitShot,
} from '@/lib/commit-observed'
import { getOwnedEventBySlug } from '@/lib/events'
import { hostParticipant } from '@/lib/host-capture'
import { reportServerIssue } from '@/lib/telemetry-server'
import type { ReserveState } from '@/app/(product)/e/[slug]/actions'

/**
 * The host's camera, and the reason it is not the guest's.
 *
 * The three RPCs underneath are the same ones a guest uses, and the shot
 * accounting is identical — a frame is taken inside the participant row's
 * lock, a `pending` row expires after ten minutes, hidden photos still count.
 * What differs is only who is asking, and how that is established:
 *
 * - a guest presents the httpOnly token in their `/e/<slug>` cookie;
 * - a host presents nothing. `getOwnedEventBySlug` returning null under
 *   ownership RLS is the check, exactly as it is everywhere else in this
 *   folder, and `hostParticipant` then resolves their row from `auth.uid()`.
 *
 * That is also why these live here rather than in the guest's action file. A
 * Server Action posts to the path of the page that owns it: a guest action
 * called from `/host/events/<slug>` would arrive with no participant cookie
 * and refuse every time.
 */

async function resolve(slug: string) {
  const event = await getOwnedEventBySlug(slug)
  if (!event) return null
  const participant = await hostParticipant(event.id)
  if (!participant) return null
  return { event, participant }
}

/** Claim one frame off the host's own roll. */
export async function hostReserveShotAction(
  slug: string,
  idempotencyKey: string,
): Promise<ReserveState> {
  const resolved = await resolve(slug)
  if (!resolved) return { ok: false, refusal: 'no_session' }
  const { event, participant } = resolved

  // The two emergency levers apply to the host as well. `OURFILM_UPLOADS_DISABLED`
  // is a storage brake, not a guest-behaviour one, and an event over its byte
  // ceiling is over it whoever is holding the phone.
  if (process.env.OURFILM_UPLOADS_DISABLED === 'true') {
    return { ok: false, refusal: 'uploads_disabled' }
  }

  let result
  try {
    result = await reserveShot({
      eventId: event.id,
      tokenHash: participant.tokenHash,
      idempotencyKey,
    })
  } catch (e) {
    await reportServerIssue(e, {
      operation: 'reserve_shot',
      eventId: event.id,
      route: '/host/events/[slug]',
      routeType: 'action',
    })
    throw e
  }

  if (!result.ok) return { ok: false, refusal: result.refusal as ShotRefusal }

  return {
    ok: true,
    photoId: result.shot.photoId,
    shotsRemaining: result.shot.shotsRemaining,
    uploads: result.shot.uploads,
  }
}

/** Mark a frame's renders as landed. Returns the authoritative count. */
export async function hostCommitShotAction({
  slug,
  photoId,
  width,
  height,
  byteSize,
  takenAt,
  captureId,
  attemptId,
}: {
  slug: string
  photoId: string
  width: number
  height: number
  byteSize: number
  takenAt: string | null
  captureId?: string
  attemptId?: string
}): Promise<CommitShotAnswer> {
  // Same observation as the guest's commit, and the same weight: the bytes are
  // in Storage and a row that never goes `ready` is a photo nobody is shown.
  // Only the identification differs, and its two refusals are told apart.
  const result = await observeCommitShot({
    surface: 'host',
    route: '/host/events/[slug]',
    input: { photoId, width, height, byteSize, takenAt, captureId, attemptId },
    deps: liveCommitDeps(async () => {
      const event = await getOwnedEventBySlug(slug)
      if (!event) return { ok: false, refusal: 'not_owner' }
      const participant = await hostParticipant(event.id)
      if (!participant) return { ok: false, refusal: 'no_participant' }
      return { ok: true, tokenHash: participant.tokenHash, eventId: event.id }
    }),
  })

  if (result.committed) {
    // The moderation grid and the page's own figure row are both server
    // rendered from `getAllEventPhotos`, so a landed frame has to drop them.
    revalidatePath(`/host/events/${slug}`)
    revalidatePath(`/e/${slug}`)
  }

  return result
}

/** Give a frame back after a failed upload. Best effort; the reservation
 *  expires on its own after ten minutes either way. */
export async function hostReleaseShotAction(
  slug: string,
  photoId: string,
): Promise<void> {
  const resolved = await resolve(slug)
  if (!resolved) return
  await releaseShot({ photoId, tokenHash: resolved.participant.tokenHash })
}
