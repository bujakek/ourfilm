import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  anonClient,
  createEvent,
  createUser,
  deleteEvent,
  deleteUser,
  joinEvent,
  markPaid,
  newSession,
  serviceClient,
  takeShot,
  userClient,
  type TestUser,
} from './harness'

/**
 * The reveal, and who can see what before it.
 *
 * `event_gallery_by_slug` carries the reveal in its own `where` clause, which
 * is the whole design: the page skipping the query is about not serialising an
 * album into a payload nobody may see, but the RPC is what makes the gate true
 * when the caller is curl.
 *
 * The organizer reads the tables directly under ownership RLS and never touches
 * this function, which is how they moderate before the reveal.
 */

const HOUR = 60 * 60 * 1000

let host: TestUser

beforeAll(async () => {
  host = await createUser()
}, 60_000)

afterAll(async () => {
  if (host) await deleteUser(host.id)
})

/** Shoot one photo into an event and return its id. */
async function seedPhoto(eventId: string, slug: string) {
  const session = newSession()
  await joinEvent(slug, 'Réka', session)
  const shot = await takeShot(eventId, session)
  return shot?.photo_id as string
}

/** What a guest sees through the public gallery RPC. */
async function guestGallery(slug: string) {
  const { data, error } = await anonClient().rpc('event_gallery_by_slug', {
    p_slug: slug,
  })
  if (error) throw error
  return data ?? []
}

describe('reveal modes', () => {
  it('opens with the camera in instant mode', async () => {
    const event = await createEvent({
      ownerId: host.id,
      captureStartAt: new Date(Date.now() - HOUR),
      captureEndAt: new Date(Date.now() + HOUR),
      revealMode: 'instant',
    })
    try {
      await seedPhoto(event.id, event.slug)

      // The trigger pins reveal_at to the capture start, which is in the past,
      // so the album is already open while guests are still shooting.
      expect(await guestGallery(event.slug)).toHaveLength(1)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('stays shut until the camera closes in event_end mode', async () => {
    const event = await createEvent({
      ownerId: host.id,
      captureStartAt: new Date(Date.now() - HOUR),
      captureEndAt: new Date(Date.now() + HOUR),
      revealMode: 'event_end',
    })
    try {
      await seedPhoto(event.id, event.slug)
      expect(await guestGallery(event.slug)).toHaveLength(0)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('opens once the capture end has passed in event_end mode', async () => {
    const end = new Date(Date.now() - HOUR)
    const event = await createEvent({
      ownerId: host.id,
      captureStartAt: new Date(Date.now() - 2 * HOUR),
      captureEndAt: end,
      revealMode: 'event_end',
    })
    try {
      // Shot before the window closed; the fixture just backdates the window.
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)
      await serviceClient()
        .from('events')
        .update({ capture_end_at: new Date(Date.now() + HOUR).toISOString() })
        .eq('id', event.id)
      await takeShot(event.id, session)
      await serviceClient()
        .from('events')
        .update({ capture_end_at: end.toISOString() })
        .eq('id', event.id)

      expect(await guestGallery(event.slug)).toHaveLength(1)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('waits for the chosen moment in custom mode', async () => {
    const end = new Date(Date.now() + HOUR)
    const event = await createEvent({
      ownerId: host.id,
      captureStartAt: new Date(Date.now() - HOUR),
      captureEndAt: end,
      revealMode: 'custom',
      revealAt: new Date(end.getTime() + 24 * HOUR),
    })
    try {
      await seedPhoto(event.id, event.slug)
      expect(await guestGallery(event.slug)).toHaveLength(0)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)
})

describe('the reveal trigger', () => {
  it('moves the reveal when an event_end capture window moves', async () => {
    const event = await createEvent({
      ownerId: host.id,
      captureEndAt: new Date(Date.now() + HOUR),
      revealMode: 'event_end',
    })
    try {
      const moved = new Date(Date.now() + 5 * HOUR)
      await serviceClient()
        .from('events')
        .update({ capture_end_at: moved.toISOString() })
        .eq('id', event.id)

      const { data } = await serviceClient()
        .from('events')
        .select('reveal_at')
        .eq('id', event.id)
        .single()

      // No caller has to remember to recompute this. That is the point of
      // materialising `reveal_at` in a trigger rather than deriving it per read.
      expect(new Date(data!.reveal_at).getTime()).toBe(moved.getTime())
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('pins the reveal to the capture start in instant mode', async () => {
    const start = new Date(Date.now() - HOUR)
    const event = await createEvent({
      ownerId: host.id,
      captureStartAt: start,
      revealMode: 'instant',
      // Deliberately wrong — the trigger must overrule it.
      revealAt: new Date(Date.now() + 99 * HOUR),
    })
    try {
      const { data } = await serviceClient()
        .from('events')
        .select('reveal_at')
        .eq('id', event.id)
        .single()

      expect(new Date(data!.reveal_at).getTime()).toBe(start.getTime())
    } finally {
      await deleteEvent(event.id)
    }
  })
})

describe('guest visibility', () => {
  it('denies guests after the reveal when the host switched them off', async () => {
    const event = await createEvent({
      ownerId: host.id,
      captureStartAt: new Date(Date.now() - HOUR),
      captureEndAt: new Date(Date.now() + HOUR),
      revealMode: 'instant',
      guestsCanView: false,
    })
    try {
      await seedPhoto(event.id, event.slug)

      // Revealed, and still nothing: this is a decision rather than a wait.
      expect(await guestGallery(event.slug)).toHaveLength(0)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('lets the organizer read the album before the reveal', async () => {
    const event = await createEvent({
      ownerId: host.id,
      captureStartAt: new Date(Date.now() - HOUR),
      captureEndAt: new Date(Date.now() + HOUR),
      revealMode: 'custom',
      revealAt: new Date(Date.now() + 48 * HOUR),
      guestsCanView: false,
    })
    try {
      await seedPhoto(event.id, event.slug)
      expect(await guestGallery(event.slug)).toHaveLength(0)

      // The host reads the table under ownership RLS and never goes through the
      // gallery RPC, which is what lets them moderate before the reveal.
      const { data, error } = await userClient(host.accessToken)
        .from('photos')
        .select('id')
        .eq('event_id', event.id)

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('does not let a different host read the album', async () => {
    const stranger = await createUser()
    const event = await createEvent({ ownerId: host.id })
    try {
      await seedPhoto(event.id, event.slug)

      const { data } = await userClient(stranger.accessToken)
        .from('photos')
        .select('id')
        .eq('event_id', event.id)

      expect(data ?? []).toHaveLength(0)
    } finally {
      await deleteEvent(event.id)
      await deleteUser(stranger.id)
    }
  }, 60_000)

  it('hides a moderated photo from guests', async () => {
    const event = await createEvent({
      ownerId: host.id,
      captureStartAt: new Date(Date.now() - HOUR),
      captureEndAt: new Date(Date.now() + HOUR),
      revealMode: 'instant',
    })
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)
      const first = await takeShot(event.id, session)
      await takeShot(event.id, session)

      expect(await guestGallery(event.slug)).toHaveLength(2)

      await serviceClient()
        .from('photos')
        .update({ hidden_at: new Date().toISOString() })
        .eq('id', first?.photo_id as string)

      expect(await guestGallery(event.slug)).toHaveLength(1)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('hides a reserved-but-uncommitted frame from guests', async () => {
    const event = await createEvent({
      ownerId: host.id,
      captureStartAt: new Date(Date.now() - HOUR),
      captureEndAt: new Date(Date.now() + HOUR),
      revealMode: 'instant',
    })
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)

      // Reserved only — the bytes may still be uploading, so a gallery tile
      // pointing at it would be permanently broken.
      const { reserveShot } = await import('./harness')
      await reserveShot(event.id, session)

      expect(await guestGallery(event.slug)).toHaveLength(0)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)
})

describe('early reveal', () => {
  it('durably opens the gallery', async () => {
    const event = await createEvent({
      ownerId: host.id,
      captureStartAt: new Date(Date.now() - HOUR),
      captureEndAt: new Date(Date.now() + HOUR),
      revealMode: 'event_end',
    })
    try {
      await seedPhoto(event.id, event.slug)
      expect(await guestGallery(event.slug)).toHaveLength(0)

      // A legacy early reveal is a real instant, not a display flag, so this
      // remains backwards-compatibility coverage for custom events.
      await userClient(host.accessToken)
        .from('events')
        .update({ reveal_mode: 'custom', reveal_at: new Date().toISOString() })
        .eq('id', event.id)

      expect(await guestGallery(event.slug)).toHaveLength(1)

      const { data } = await serviceClient()
        .from('events')
        .select('reveal_mode, reveal_at')
        .eq('id', event.id)
        .single()
      expect(data?.reveal_mode).toBe('custom')
      expect(new Date(data!.reveal_at).getTime()).toBeLessThanOrEqual(
        Date.now(),
      )
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('is not something a guest can trigger', async () => {
    const event = await createEvent({
      ownerId: host.id,
      captureStartAt: new Date(Date.now() - HOUR),
      captureEndAt: new Date(Date.now() + HOUR),
      revealMode: 'event_end',
    })
    try {
      await seedPhoto(event.id, event.slug)

      await anonClient()
        .from('events')
        .update({ reveal_at: new Date(Date.now() - HOUR).toISOString() })
        .eq('id', event.id)

      // Assert on what a guest can actually see, not on the status code.
      expect(await guestGallery(event.slug)).toHaveLength(0)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)
})

describe('the paid entitlement', () => {
  it('cannot be granted from the client', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      // No update policy on `purchases` at all, and the insert policy pins
      // status to 'pending'. Only the webhook, running as the service role,
      // can write 'paid'.
      await userClient(host.accessToken)
        .from('purchases')
        .insert({
          event_id: event.id,
          owner_id: host.id,
          stripe_checkout_session_id: `cs_forged_${event.id}`,
          status: 'paid',
          amount_minor: 1290000,
          currency: 'huf',
        })

      const { data } = await serviceClient()
        .from('purchases')
        .select('status')
        .eq('event_id', event.id)

      expect(data ?? []).toHaveLength(0)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('cannot be granted by editing a pending row', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const host_ = userClient(host.accessToken)
      await host_.from('purchases').insert({
        event_id: event.id,
        owner_id: host.id,
        stripe_checkout_session_id: `cs_pending_${event.id}`,
        status: 'pending',
      })

      await host_
        .from('purchases')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('event_id', event.id)

      const { data } = await serviceClient()
        .from('purchases')
        .select('status')
        .eq('event_id', event.id)
        .single()

      // Still pending. A host who could write this column could hand
      // themselves a paid album for free.
      expect(data?.status).toBe('pending')
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('lifts the participant cap once a payment settles', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      for (let i = 0; i < 5; i++) {
        await joinEvent(event.slug, `Vendég ${i}`, newSession())
      }
      const capped = await joinEvent(event.slug, 'Hatodik', newSession())
      expect(capped?.cap_reached).toBe(true)

      // Exactly what the Stripe webhook writes.
      await markPaid(event.id, host.id)

      const admitted = await joinEvent(event.slug, 'Hatodik', newSession())
      expect(admitted?.cap_reached).toBe(false)
      expect(admitted?.participant_id).toBeTruthy()
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('is priced once per event, with no guest quantity', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      await markPaid(event.id, host.id)

      const { data } = await serviceClient()
        .from('purchases')
        .select('amount_minor, currency')
        .eq('event_id', event.id)
        .single()

      // 12 900 Ft in Stripe's minor units. One row, one event, no per-guest
      // multiplier anywhere in the schema.
      expect(data?.amount_minor).toBe(1290000)
      expect(data?.currency).toBe('huf')
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)
})
