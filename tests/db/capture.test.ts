import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  anonClient,
  countPhotos,
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
 * The roll of film.
 *
 * Every guest gets their own count, and no sequence of requests may exceed it.
 * `reserve_shot` takes a `for update` on the participant row, so a guest's own
 * concurrent captures serialise against each other — and, importantly, only
 * against each other: two different guests must not block one another on the
 * busiest path in the product.
 */

let host: TestUser

beforeAll(async () => {
  host = await createUser()
}, 60_000)

afterAll(async () => {
  if (host) await deleteUser(host.id)
})

describe('the shot limit', () => {
  it('gives each participant an independent roll', async () => {
    const event = await createEvent({
      ownerId: host.id,
      shotsPerParticipant: 5,
    })
    try {
      const a = newSession()
      const b = newSession()
      await joinEvent(event.slug, 'Réka', a)
      await joinEvent(event.slug, 'Máté', b)

      for (let i = 0; i < 5; i++) await takeShot(event.id, a)

      // A is out of film; B has not touched theirs.
      const aRefused = await reserveShot(event.id, a)
      expect(aRefused?.refusal).toBe('no_shots')

      const bAllowed = await reserveShot(event.id, b)
      expect(bAllowed?.refusal).toBeNull()
      expect(bAllowed?.shots_remaining).toBe(4)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it.each([5, 10, 16, 24, 36])(
    'enforces a roll of %i',
    async (limit) => {
      const event = await createEvent({
        ownerId: host.id,
        shotsPerParticipant: limit,
      })
      try {
        const session = newSession()
        await joinEvent(event.slug, 'Réka', session)

        for (let i = 0; i < limit; i++) {
          const shot = await takeShot(event.id, session)
          expect(shot?.refusal).toBeNull()
        }

        const oneTooMany = await reserveShot(event.id, session)
        expect(oneTooMany?.refusal).toBe('no_shots')
        expect(await countPhotos(event.id)).toBe(limit)
      } finally {
        await deleteEvent(event.id)
      }
    },
    120_000,
  )

  it('counts down to zero and reports it', async () => {
    const event = await createEvent({
      ownerId: host.id,
      shotsPerParticipant: 5,
    })
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)

      const remaining: number[] = []
      for (let i = 0; i < 5; i++) {
        const shot = await takeShot(event.id, session)
        remaining.push(shot?.shots_remaining as number)
      }

      // The number the camera renders comes from here, never from local
      // arithmetic — this is the sequence a guest sees.
      expect(remaining).toEqual([4, 3, 2, 1, 0])
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('holds under concurrent captures', async () => {
    const event = await createEvent({
      ownerId: host.id,
      shotsPerParticipant: 5,
    })
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Gyors ujjú', session)

      // Twelve genuinely parallel reservations from one participant — a
      // double-tapped shutter, two tabs, a retry racing the original. Without
      // the row lock every one of these reads the same count and every one
      // inserts.
      const results = await Promise.all(
        Array.from({ length: 12 }, () => reserveShot(event.id, session)),
      )

      const granted = results.filter((r) => !r?.refusal)
      const refused = results.filter((r) => r?.refusal === 'no_shots')

      expect(granted).toHaveLength(5)
      expect(refused).toHaveLength(7)
      expect(await countPhotos(event.id)).toBe(5)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('does not let two guests block each other', async () => {
    const event = await createEvent({
      ownerId: host.id,
      shotsPerParticipant: 5,
    })
    try {
      const a = newSession()
      const b = newSession()
      await joinEvent(event.slug, 'Réka', a)
      await joinEvent(event.slug, 'Máté', b)

      // Ten parallel reservations across two participants: both rolls fill,
      // neither steals from the other.
      const results = await Promise.all([
        ...Array.from({ length: 5 }, () => reserveShot(event.id, a)),
        ...Array.from({ length: 5 }, () => reserveShot(event.id, b)),
      ])

      expect(results.filter((r) => !r?.refusal)).toHaveLength(10)
      expect(await countPhotos(event.id)).toBe(10)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)
})

describe('failed and retried uploads', () => {
  it('gives the frame back when the upload fails', async () => {
    const event = await createEvent({
      ownerId: host.id,
      shotsPerParticipant: 5,
    })
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)

      const reserved = await reserveShot(event.id, session)
      expect(reserved?.shots_remaining).toBe(4)

      // The upload throws; the client releases what it claimed.
      const { error } = await serviceClient().rpc('release_shot', {
        p_photo_id: reserved?.photo_id as string,
        p_token_hash: session.hash,
      })
      expect(error).toBeNull()

      // Nothing was spent.
      expect(await countPhotos(event.id)).toBe(0)
      const next = await reserveShot(event.id, session)
      expect(next?.shots_remaining).toBe(4)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('spends exactly one frame on a successful capture', async () => {
    const event = await createEvent({
      ownerId: host.id,
      shotsPerParticipant: 5,
    })
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)

      await takeShot(event.id, session)

      expect(await countPhotos(event.id, 'ready')).toBe(1)
      expect(await countPhotos(event.id, 'pending')).toBe(0)
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('does not duplicate when a retry reuses the idempotency key', async () => {
    const event = await createEvent({
      ownerId: host.id,
      shotsPerParticipant: 5,
    })
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)

      // One shutter press, three attempts — the key is minted once per press.
      const key = randomUUID()
      const first = await reserveShot(event.id, session, key)
      const second = await reserveShot(event.id, session, key)
      const third = await reserveShot(event.id, session, key)

      expect(second?.photo_id).toBe(first?.photo_id)
      expect(third?.photo_id).toBe(first?.photo_id)
      expect(second?.storage_path).toBe(first?.storage_path)
      expect(await countPhotos(event.id)).toBe(1)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('refuses to release a committed photo', async () => {
    const event = await createEvent({
      ownerId: host.id,
      shotsPerParticipant: 5,
    })
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)
      const shot = await takeShot(event.id, session)

      // A late release must not destroy a photo that committed in the
      // meantime — `release_shot` only ever deletes a pending row.
      await serviceClient().rpc('release_shot', {
        p_photo_id: shot?.photo_id as string,
        p_token_hash: session.hash,
      })

      expect(await countPhotos(event.id, 'ready')).toBe(1)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('does not refund a frame when the host hides a photo', async () => {
    const event = await createEvent({
      ownerId: host.id,
      shotsPerParticipant: 5,
    })
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)

      const first = await takeShot(event.id, session)
      for (let i = 0; i < 4; i++) await takeShot(event.id, session)

      // Moderation is not deletion: the object still exists and still cost the
      // guest a frame. Refunding on hide would make hiding a way to shoot
      // forever.
      await serviceClient()
        .from('photos')
        .update({ hidden_at: new Date().toISOString() })
        .eq('id', first?.photo_id as string)

      const refused = await reserveShot(event.id, session)
      expect(refused?.refusal).toBe('no_shots')
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)
})

describe('the capture window', () => {
  it('refuses before it opens', async () => {
    const event = await createEvent({
      ownerId: host.id,
      captureStartAt: new Date(Date.now() + 3600_000),
      captureEndAt: new Date(Date.now() + 7200_000),
    })
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Korán jött', session)

      const result = await reserveShot(event.id, session)
      expect(result?.refusal).toBe('not_started')
      expect(await countPhotos(event.id)).toBe(0)
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('refuses after it closes', async () => {
    const event = await createEvent({
      ownerId: host.id,
      captureStartAt: new Date(Date.now() - 7200_000),
      captureEndAt: new Date(Date.now() - 3600_000),
      revealAt: new Date(Date.now() - 3600_000),
    })
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Későn jött', session)

      // A page left open past the end of the event still looks like it can
      // shoot. This is what makes it wrong.
      const result = await reserveShot(event.id, session)
      expect(result?.refusal).toBe('ended')
      expect(await countPhotos(event.id)).toBe(0)
    } finally {
      await deleteEvent(event.id)
    }
  })
})

describe('capture cannot be reached from the client', () => {
  it('refuses a session token that matches nothing', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      await joinEvent(event.slug, 'Réka', newSession())

      // Knowing an event id is not enough: without a participant session there
      // is no roll of film to spend from.
      const stranger = newSession()
      const result = await reserveShot(event.id, stranger)
      expect(result?.refusal).toBe('no_session')
      expect(await countPhotos(event.id)).toBe(0)
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('does not expose the capture RPCs to the anon key', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)

      // The four write RPCs are granted to `service_role` alone, so a guest
      // holding their own token hash still cannot call them directly. This is
      // what makes the limit something a hand-rolled fetch cannot walk around.
      const guest = anonClient()

      for (const call of [
        guest.rpc('reserve_shot', {
          p_event_id: event.id,
          p_token_hash: session.hash,
          p_idempotency_key: randomUUID(),
        }),
        guest.rpc('join_event', {
          p_slug: event.slug,
          p_name: 'Betolakodó',
          p_token_hash: newSession().hash,
        }),
      ]) {
        const { error } = await call
        expect(error).not.toBeNull()
      }

      expect(await countPhotos(event.id)).toBe(0)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('does not let a guest insert a photo row directly', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const session = newSession()
      const joined = await joinEvent(event.slug, 'Réka', session)

      // The old model let anon insert into `photos`. It no longer can, which is
      // the difference between a shot limit and a suggestion.
      await anonClient()
        .from('photos')
        .insert({
          event_id: event.id,
          participant_id: joined?.participant_id as string,
          storage_path: `${event.id}/fake.jpg`,
          thumb_path: `${event.id}/fake_thumb.jpg`,
          status: 'ready',
        })

      // Assert on the row count, not the status.
      expect(await countPhotos(event.id)).toBe(0)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('does not let a guest raise their own limit', async () => {
    const event = await createEvent({
      ownerId: host.id,
      shotsPerParticipant: 5,
    })
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)

      // Guests have no policy on `events` at all, so this matches zero rows.
      await anonClient()
        .from('events')
        .update({ shots_per_participant: 36 })
        .eq('id', event.id)

      const { data } = await serviceClient()
        .from('events')
        .select('shots_per_participant')
        .eq('id', event.id)
        .single()

      expect(data?.shots_per_participant).toBe(5)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)
})
