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
  type TestUser,
} from './harness'

/**
 * The reveal-locked gallery as tiles, and what a tile may carry.
 *
 * `event_developing_gallery_by_slug` exists so a guest can see that the roll
 * is filling up before anyone may look at it. The property worth a real
 * database is the negative one: with the bucket public, an id or a path in
 * this answer would be the photo, so every test here also checks that neither
 * ever comes back — through the anon key, which is what anyone holds.
 */

const HOUR = 60 * 60 * 1000

let host: TestUser

beforeAll(async () => {
  host = await createUser()
}, 60_000)

afterAll(async () => {
  if (host) await deleteUser(host.id)
})

async function wall(slug: string) {
  const { data, error } = await anonClient().rpc(
    'event_developing_gallery_by_slug',
    { p_slug: slug },
  )
  if (error) throw error
  return data ?? []
}

async function gallery(slug: string) {
  const { data, error } = await anonClient().rpc('event_gallery_by_slug', {
    p_slug: slug,
  })
  if (error) throw error
  return data ?? []
}

/** An event whose camera is open and whose album opens when it closes. */
function lockedEvent(options: { guestsCanView?: boolean } = {}) {
  return createEvent({
    ownerId: host.id,
    captureStartAt: new Date(Date.now() - HOUR),
    captureEndAt: new Date(Date.now() + HOUR),
    revealMode: 'event_end',
    ...options,
  })
}

describe('before the reveal', () => {
  it('shows every waiting photo as a name and a seed, and nothing else', async () => {
    const event = await lockedEvent()
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)
      const first = await takeShot(event.id, session)
      const second = await takeShot(event.id, session)

      const rows = await wall(event.slug)
      expect(rows).toHaveLength(2)
      expect(await gallery(event.slug)).toHaveLength(0)

      for (const row of rows) {
        expect(Object.keys(row).sort()).toEqual([
          'tile_seed',
          'total_count',
          'uploader_name',
        ])
        expect(row.uploader_name).toBe('Réka')
        expect(row.total_count).toBe(2)
        expect(Number.isInteger(row.tile_seed)).toBe(true)
      }

      // Not the id, not a path, not the event: nothing a URL can be built from.
      const answer = JSON.stringify(rows)
      for (const secret of [
        first?.photo_id,
        second?.photo_id,
        first?.thumb_path,
        event.id,
      ]) {
        expect(secret).toBeTruthy()
        expect(answer).not.toContain(secret as string)
      }
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('gives each photo its own stable seed', async () => {
    const event = await lockedEvent()
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)
      await takeShot(event.id, session)
      await takeShot(event.id, session)

      const seeds = (await wall(event.slug)).map((row) => row.tile_seed)
      const again = (await wall(event.slug)).map((row) => row.tile_seed)

      expect(again).toEqual(seeds)
      expect(new Set(seeds).size).toBe(2)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('leaves out hidden and uncommitted frames', async () => {
    const event = await lockedEvent()
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)
      await takeShot(event.id, session)
      const hidden = await takeShot(event.id, session)
      await reserveShot(event.id, session)

      await serviceClient()
        .from('photos')
        .update({ hidden_at: new Date().toISOString() })
        .eq('id', hidden?.photo_id as string)

      const rows = await wall(event.slug)
      expect(rows).toHaveLength(1)
      expect(rows[0].total_count).toBe(1)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('shows the newest 24 and still counts the whole roll', async () => {
    const event = await lockedEvent()
    try {
      // Two guests, because one roll is 24 frames.
      const réka = newSession()
      const bence = newSession()
      await joinEvent(event.slug, 'Réka', réka)
      await joinEvent(event.slug, 'Bence', bence)
      for (let i = 0; i < 24; i++) await takeShot(event.id, réka)
      await takeShot(event.id, bence)
      await takeShot(event.id, bence)

      const rows = await wall(event.slug)
      expect(rows).toHaveLength(24)
      expect(rows.every((row) => row.total_count === 26)).toBe(true)
      // Newest first: Bence shot last.
      expect(rows[0].uploader_name).toBe('Bence')
    } finally {
      await deleteEvent(event.id)
    }
  }, 120_000)
})

describe('when there is nothing to wait for', () => {
  it('goes quiet the moment the album opens', async () => {
    const event = await createEvent({
      ownerId: host.id,
      captureStartAt: new Date(Date.now() - HOUR),
      captureEndAt: new Date(Date.now() + HOUR),
      revealMode: 'instant',
    })
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)
      await takeShot(event.id, session)

      // The complement of the gallery: never both at once.
      expect(await gallery(event.slug)).toHaveLength(1)
      expect(await wall(event.slug)).toHaveLength(0)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('says nothing while the host keeps guests out', async () => {
    const event = await lockedEvent({ guestsCanView: false })
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)
      await takeShot(event.id, session)

      expect(await wall(event.slug)).toHaveLength(0)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)
})
