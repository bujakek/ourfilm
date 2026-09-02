import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  anonClient,
  createEvent,
  createUser,
  deleteEvent,
  deleteUser,
  joinEvent,
  newSession,
  reserveShot,
  serviceClient,
  takeShot,
  type Session,
  type TestUser,
} from './harness'

/**
 * A guest's own roll.
 *
 * `my_frames` is the one read in the product that deliberately ignores the
 * reveal, so the properties that keep it narrow are the ones worth proving
 * against a real Postgres rather than reasoning about: that the session token
 * is the only key, that another guest's frames are unreachable with it, and
 * that the browser's anon key cannot call it at all.
 *
 * The last one is not paranoia. `revoke … from public` does not remove
 * Supabase's direct grants to `anon` and `authenticated`, and this repo has
 * shipped that mistake twice — `20260825080000_lock_down_capture_rpcs.sql` and
 * `20260818172146_restrict_admin_event_previews.sql` both exist because a test
 * like this one caught it.
 */

const HOUR = 60 * 60 * 1000

let host: TestUser

beforeAll(async () => {
  host = await createUser()
}, 60_000)

afterAll(async () => {
  if (host) await deleteUser(host.id)
})

async function myFrames(eventId: string, session: Session) {
  const { data, error } = await serviceClient().rpc('my_frames', {
    p_event_id: eventId,
    p_token_hash: session.hash,
  })
  if (error) throw error
  return data ?? []
}

describe('my_frames', () => {
  it('returns only the calling participant’s own frames', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const mine = newSession()
      const theirs = newSession()
      await joinEvent(event.slug, 'Réka', mine)
      await joinEvent(event.slug, 'Máté', theirs)

      await takeShot(event.id, mine)
      await takeShot(event.id, mine)
      await takeShot(event.id, theirs)

      const frames = await myFrames(event.id, mine)

      expect(frames).toHaveLength(2)
      expect(frames.map((f) => f.frame_index)).toEqual([1, 2])
      // Three photos exist in this event; only two of them are ours.
      expect(await myFrames(event.id, theirs)).toHaveLength(1)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('is not reveal-gated, while the shared gallery still is', async () => {
    // Reveals an hour after the camera closes, so nothing has developed yet.
    const end = new Date(Date.now() + HOUR)
    const event = await createEvent({
      ownerId: host.id,
      captureEndAt: end,
      revealMode: 'event_end',
      revealAt: new Date(end.getTime() + HOUR),
    })
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)
      await takeShot(event.id, session)

      // The group cannot see the night yet …
      const { data: gallery } = await anonClient().rpc(
        'event_gallery_by_slug',
        {
          p_slug: event.slug,
        },
      )
      expect(gallery ?? []).toHaveLength(0)

      // … but the photographer can see her own frame, which is the whole point:
      // the reveal withholds everyone else's photos, not yours.
      const frames = await myFrames(event.id, session)
      expect(frames).toHaveLength(1)
      expect(frames[0].thumb_path).toContain(event.id)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('returns nothing for a token that matches no participant', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const joined = newSession()
      await joinEvent(event.slug, 'Réka', joined)
      await takeShot(event.id, joined)

      // A guest who never joined, and a forged hash, take the same code path.
      expect(await myFrames(event.id, newSession())).toHaveLength(0)
      expect(await myFrames(event.id, { token: '', hash: '' })).toHaveLength(0)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('exposes no frame for a reservation that never committed', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)

      await takeShot(event.id, session)
      // Reserved but not committed: the frame is spent, but there are no bytes
      // behind it, so the strip must not draw a broken cell.
      await reserveShot(event.id, session)

      expect(await myFrames(event.id, session)).toHaveLength(1)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('keeps a hidden photo’s frame but withholds its thumbnail', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)
      const first = await takeShot(event.id, session)
      await takeShot(event.id, session)

      await serviceClient()
        .from('photos')
        .update({ hidden_at: new Date().toISOString() })
        .eq('id', first?.photo_id as string)

      const frames = await myFrames(event.id, session)

      // Hiding is moderation, not a refund: `participant_shots_used` counts a
      // hidden photo, so the frame has to stay spent here too or the strip
      // would disagree with the counter above it.
      expect(frames).toHaveLength(2)
      expect(frames[0].frame_index).toBe(1)
      expect(frames[0].thumb_path).toBeNull()
      expect(frames[1].thumb_path).not.toBeNull()
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('is not callable with the anon key', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)
      await takeShot(event.id, session)

      // The token hash is presentable but not secret once observed, so anon
      // execute would make an intercepted hash enough to read someone's roll.
      const { data, error } = await anonClient().rpc('my_frames', {
        p_event_id: event.id,
        p_token_hash: session.hash,
      })

      expect(error).toBeTruthy()
      expect(data ?? []).toHaveLength(0)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)
})
