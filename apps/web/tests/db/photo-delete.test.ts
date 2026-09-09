import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  anonClient,
  createEvent,
  createUser,
  deleteEvent,
  deleteUser,
  joinEvent,
  newSession,
  serviceClient,
  takeShot,
  type TestUser,
} from './harness'

/**
 * A deleted photo is a tombstone, and this is why.
 *
 * `participant_shots_used` counts photo rows. Delete the row and the guest
 * gets their frame back — the host would have found a way to hand out extra
 * film, and "no preview, no retakes" would quietly stop being true for anyone
 * whose photo was tidied away. So the delete removes the three storage objects
 * and writes `deleted_at` and `hidden_at`, and the row stays.
 *
 * These tests are on the *properties*, not on the Server Action: the action
 * runs on a host's session and this suite has no browser. What is worth
 * pinning is that the shape of the row a delete leaves behind means what it is
 * supposed to mean to everything that reads it.
 */

const HOUR = 60 * 60 * 1000

let host: TestUser

beforeAll(async () => {
  host = await createUser()
}, 60_000)

afterAll(async () => {
  if (host) await deleteUser(host.id)
})

/** What the camera would tell this guest they have left. A read, so nothing
 *  about asking changes the answer. */
async function shotsRemaining(slug: string, tokenHash: string) {
  const { data, error } = await serviceClient()
    .rpc('event_guest_state', { p_slug: slug, p_token_hash: tokenHash })
    .maybeSingle()
  if (error) throw error
  return data?.shots_remaining as number
}

/** What a delete writes: the row survives, marked. */
async function tombstone(photoId: string) {
  const now = new Date().toISOString()
  const { error } = await serviceClient()
    .from('photos')
    .update({ deleted_at: now, hidden_at: now })
    .eq('id', photoId)
  if (error) throw error
}

async function openEvent() {
  return createEvent({
    ownerId: host.id,
    captureStartAt: new Date(Date.now() - HOUR),
    captureEndAt: new Date(Date.now() + HOUR),
    revealMode: 'instant',
  })
}

describe('a deleted photo', () => {
  it('still counts against the roll it was taken from', async () => {
    const event = await openEvent()
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)
      const shot = await takeShot(event.id, session)

      // Read, never reserve. A reservation spends a frame of its own, which is
      // the thing being measured.
      const before = await shotsRemaining(event.slug, session.hash)
      await tombstone(shot?.photo_id as string)
      const after = await shotsRemaining(event.slug, session.hash)

      // This is the whole reason the row survives. If it dropped out of
      // `participant_shots_used`, the guest would be handed the frame back and
      // a host could deal out extra film by deleting.
      expect(after).toBe(before)
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('leaves the guest gallery', async () => {
    const event = await openEvent()
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)
      const kept = await takeShot(event.id, session)
      const doomed = await takeShot(event.id, session)

      const { data: before } = await anonClient().rpc('event_gallery_by_slug', {
        p_slug: event.slug,
      })
      expect(before).toHaveLength(2)

      await tombstone(doomed?.photo_id as string)

      const { data: after } = await anonClient().rpc('event_gallery_by_slug', {
        p_slug: event.slug,
      })
      // `hidden_at` is what every guest-facing RPC already gates on, which is
      // why the delete sets it and why none of them needed changing.
      expect(after).toHaveLength(1)
      expect(after?.[0]?.id).toBe(kept?.photo_id)
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('is not what the host sees in their own album', async () => {
    const event = await openEvent()
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)
      await takeShot(event.id, session)
      const doomed = await takeShot(event.id, session)
      await tombstone(doomed?.photo_id as string)

      // The query the moderation grid and the album export both run. A hidden
      // photo belongs in both; a deleted one has no bytes behind it any more.
      const { data, error } = await serviceClient()
        .from('photos')
        .select('id')
        .eq('event_id', event.id)
        .eq('status', 'ready')
        .is('deleted_at', null)
      if (error) throw error
      expect(data).toHaveLength(1)
    } finally {
      await deleteEvent(event.id)
    }
  })
})
