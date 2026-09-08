import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  countParticipants,
  createEvent,
  createUser,
  deleteEvent,
  deleteUser,
  joinEvent,
  makeAdmin,
  markPaid,
  newSession,
  serviceClient,
  type TestUser,
} from './harness'

/**
 * The free tier is a **participant** cap: five distinct guests per event, each
 * getting the host's full roll of film.
 *
 * The concurrency case is the one that matters. `join_event` takes a `for
 * update` lock on the event row before it counts, and the only way to know that
 * lock is really there is to fire genuinely parallel requests at it — a
 * sequential loop passes just as happily against a count-then-insert with no
 * lock at all.
 */

let host: TestUser

beforeAll(async () => {
  host = await createUser()
}, 60_000)

afterAll(async () => {
  if (host) await deleteUser(host.id)
})

describe('joining', () => {
  it('resumes rather than duplicating for the same session', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const session = newSession()

      const first = await joinEvent(event.slug, 'Réka', session)
      const second = await joinEvent(event.slug, 'Réka', session)

      expect(first?.participant_id).toBeTruthy()
      expect(second?.participant_id).toBe(first?.participant_id)
      expect(await countParticipants(event.id)).toBe(1)
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('updates the name when a guest rejoins with a different one', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)
      const again = await joinEvent(event.slug, 'Réka N.', session)

      expect(again?.display_name).toBe('Réka N.')
      expect(await countParticipants(event.id)).toBe(1)
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('returns nothing for a slug that does not exist', async () => {
    // Not an error, deliberately: distinguishing "no such event" from any other
    // empty answer would let anyone with the anon key test slugs for existence,
    // and the unguessable slug is the only lock an album has.
    const result = await joinEvent('no-such-event-xxxxxx', 'Réka', newSession())
    expect(result).toBeNull()
  })

  it('refuses an empty name', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      await expect(joinEvent(event.slug, '   ', newSession())).rejects.toThrow()
      expect(await countParticipants(event.id)).toBe(0)
    } finally {
      await deleteEvent(event.id)
    }
  })
})

describe('the free participant cap', () => {
  it('lets the first five in and turns the sixth away', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      for (let i = 0; i < 5; i++) {
        const result = await joinEvent(event.slug, `Vendég ${i}`, newSession())
        expect(result?.cap_reached).toBe(false)
        expect(result?.participant_id).toBeTruthy()
      }

      const sixth = await joinEvent(event.slug, 'Hatodik', newSession())
      expect(sixth?.cap_reached).toBe(true)
      expect(sixth?.participant_id).toBeNull()
      expect(await countParticipants(event.id)).toBe(5)
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('never turns away someone who already joined', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const early = newSession()
      await joinEvent(event.slug, 'Korán érkező', early)

      // Fill the rest of the cap.
      for (let i = 0; i < 4; i++) {
        await joinEvent(event.slug, `Vendég ${i}`, newSession())
      }
      expect(await countParticipants(event.id)).toBe(5)

      // Their session predates the limit; revoking it mid-event would be the
      // worst possible moment to tell someone the host has not paid.
      const again = await joinEvent(event.slug, 'Korán érkező', early)
      expect(again?.cap_reached).toBe(false)
      expect(again?.participant_id).toBeTruthy()
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('holds under concurrent joins', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      // Ten genuinely parallel requests. Without the `for update` on the event
      // row, every one of these counts zero and every one inserts.
      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          joinEvent(event.slug, `Egyszerre ${i}`, newSession()),
        ),
      )

      const admitted = results.filter((r) => r?.participant_id).length
      const refused = results.filter((r) => r?.cap_reached).length

      expect(admitted).toBe(5)
      expect(refused).toBe(5)
      expect(await countParticipants(event.id)).toBe(5)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('does not apply to a paid event', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      await markPaid(event.id, host.id)

      for (let i = 0; i < 8; i++) {
        const result = await joinEvent(event.slug, `Vendég ${i}`, newSession())
        expect(result?.cap_reached).toBe(false)
      }
      expect(await countParticipants(event.id)).toBe(8)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('does not apply to an admin-owned event', async () => {
    // How the operator runs the pilot wedding without charging themselves.
    const operator = await createUser()
    await makeAdmin(operator.id)
    const event = await createEvent({ ownerId: operator.id })
    try {
      for (let i = 0; i < 7; i++) {
        const result = await joinEvent(event.slug, `Vendég ${i}`, newSession())
        expect(result?.cap_reached).toBe(false)
      }
      expect(await countParticipants(event.id)).toBe(7)
    } finally {
      await deleteEvent(event.id)
      await deleteUser(operator.id)
    }
  }, 60_000)
})

describe('participant privacy', () => {
  it('is not readable with the anon key', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      await joinEvent(event.slug, 'Réka', newSession())

      // Guests have no select policy on `participants`. Anything anon can read
      // through PostgREST, anyone on the internet can list — and that would be
      // every guest's name at every event.
      const { anonClient } = await import('./harness')
      const { data, error } = await anonClient()
        .from('participants')
        .select('display_name')
        .eq('event_id', event.id)

      expect(error ?? data).toBeTruthy()
      expect(data ?? []).toHaveLength(0)
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('is not writable with the anon key', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)

      // Inserting a participant directly would sidestep the cap entirely.
      const { anonClient } = await import('./harness')
      await anonClient().from('participants').insert({
        event_id: event.id,
        display_name: 'Betolakodó',
        session_token_hash: 'whatever',
      })

      // Assert on the row count, not the status: RLS makes a refused write
      // look like a no-op rather than an error.
      expect(await countParticipants(event.id)).toBe(1)
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('is readable by the owning host', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      await joinEvent(event.slug, 'Réka', newSession())

      const { userClient } = await import('./harness')
      const { data, error } = await userClient(host.accessToken)
        .from('participants')
        .select('display_name')
        .eq('event_id', event.id)

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data?.[0].display_name).toBe('Réka')
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('is not readable by a different host', async () => {
    const stranger = await createUser()
    const event = await createEvent({ ownerId: host.id })
    try {
      await joinEvent(event.slug, 'Réka', newSession())

      const { userClient } = await import('./harness')
      const { data } = await userClient(stranger.accessToken)
        .from('participants')
        .select('display_name')
        .eq('event_id', event.id)

      expect(data ?? []).toHaveLength(0)
    } finally {
      await deleteEvent(event.id)
      await deleteUser(stranger.id)
    }
  }, 60_000)
})

describe('the shot-limit column', () => {
  it('accepts only the five documented rolls', async () => {
    const db = serviceClient()

    for (const shots of [5, 10, 16, 24, 36]) {
      const event = await createEvent({
        ownerId: host.id,
        shotsPerParticipant: shots,
      })
      expect(event.shots_per_participant).toBe(shots)
      await deleteEvent(event.id)
    }

    // The check constraint is the real guard — a client that skips the form
    // still cannot write 9999, and there is deliberately no unlimited option.
    for (const bad of [0, 1, 7, 25, 100, 9999]) {
      await expect(
        createEvent({ ownerId: host.id, shotsPerParticipant: bad }),
      ).rejects.toThrow()
    }

    expect(db).toBeTruthy()
  }, 60_000)

  it('defaults to 24', async () => {
    const { data, error } = await serviceClient()
      .from('events')
      .insert({
        slug: `pivot-default-${Math.random().toString(36).slice(2, 10)}`,
        event_name: 'Alapértelmezett',
        owner_id: host.id,
        capture_start_at: new Date().toISOString(),
        capture_end_at: new Date(Date.now() + 3600_000).toISOString(),
        reveal_at: new Date(Date.now() + 3600_000).toISOString(),
      })
      .select('id, shots_per_participant')
      .single()

    if (error) throw error
    try {
      expect(data.shots_per_participant).toBe(24)
    } finally {
      await deleteEvent(data.id)
    }
  })

  it('refuses a capture window that ends before it starts', async () => {
    await expect(
      createEvent({
        ownerId: host.id,
        captureStartAt: new Date(Date.now() + 3600_000),
        captureEndAt: new Date(Date.now() - 3600_000),
      }),
    ).rejects.toThrow()
  })

  it('allows a reveal instant before the capture end', async () => {
    // Deliberately permitted at the column level: "Galéria megnyitása most"
    // writes exactly this while the camera is still running. The rule that a
    // *scheduled* custom reveal may not precede the end is a form validation —
    // see `validateEventDraft` in tests/unit/camera.test.ts and `setReveal`.
    const end = new Date(Date.now() + 3600_000)
    const event = await createEvent({
      ownerId: host.id,
      captureEndAt: end,
      revealMode: 'custom',
      revealAt: new Date(Date.now() - 60_000),
    })
    try {
      expect(new Date(event.reveal_at).getTime()).toBeLessThan(Date.now())
    } finally {
      await deleteEvent(event.id)
    }
  })
})
