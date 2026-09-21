import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  anonClient,
  createEvent,
  createUser,
  deleteEvent,
  deleteUser,
  serviceClient,
  userClient,
  newSession,
  joinEvent,
  reserveShot,
  takeShot,
  type TestUser,
} from './harness'

describe('event email scheduling and delivery claims', () => {
  let host: TestUser
  const db = serviceClient()
  beforeAll(async () => {
    host = await createUser()
  })
  afterAll(async () => {
    await deleteUser(host.id)
  })

  async function dueEvent() {
    // Pick an IANA zone where it is currently noon, so today's 10:00 reminder
    // is due regardless of the machine's clock or timezone.
    const now = new Date()
    const offset = 12 - now.getUTCHours()
    const zone =
      offset === 0
        ? 'Etc/GMT'
        : `Etc/GMT${offset > 0 ? '-' : '+'}${Math.abs(offset)}`
    const event = await createEvent({
      ownerId: host.id,
      captureStartAt: new Date(now.getTime() - 4 * 86400000),
      captureEndAt: new Date(now.getTime() + 2 * 86400000),
    })
    const { error } = await db
      .from('events')
      .update({
        time_zone: zone,
        created_at: new Date(now.getTime() - 4 * 86400000).toISOString(),
      })
      .eq('id', event.id)
    if (error) throw error
    return event
  }

  it.each([
    [
      '2026-03-30T21:00:00Z',
      'Europe/Budapest',
      'upcoming',
      '2026-03-28T09:00:00+00:00',
    ],
    [
      '2026-03-28T22:00:00Z',
      'Europe/Budapest',
      'ended',
      '2026-03-29T07:00:00+00:00',
    ],
    [
      '2026-10-24T21:00:00Z',
      'Europe/Budapest',
      'ended',
      '2026-10-25T08:00:00+00:00',
    ],
    [
      '2026-09-22T02:00:00Z',
      'America/New_York',
      'ended',
      '2026-09-22T13:00:00+00:00',
    ],
  ])(
    'uses calendar days and the event timezone: %s %s %s',
    async (end, zone, kind, expected) => {
      const { data, error } = await db.rpc('event_email_due_at', {
        p_end: end,
        p_zone: zone,
        p_kind: kind,
      })
      expect(error).toBeNull()
      expect(new Date(data!).toISOString()).toBe(
        new Date(expected).toISOString(),
      )
    },
  )

  it('grants only one concurrent lease and never reclaims a sent email', async () => {
    const event = await dueEvent()
    try {
      const results = await Promise.all(
        Array.from({ length: 6 }, () => db.rpc('claim_event_email')),
      )
      for (const result of results) expect(result.error).toBeNull()
      const rows = results
        .flatMap((r) => r.data ?? [])
        .filter((r) => r.event_id === event.id)
      expect(rows).toHaveLength(1)
      expect(rows[0].kind).toBe('upcoming')
      await db
        .from('event_emails')
        .update({
          sent_at: new Date().toISOString(),
          next_attempt_at: new Date(0).toISOString(),
        })
        .eq('id', rows[0].id)
      const again = await db.rpc('claim_event_email')
      expect(again.error).toBeNull()
      expect(again.data?.some((r) => r.event_id === event.id)).toBe(false)
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('keeps the same payload and id across retry, and stops before provider deduplication expires', async () => {
    const event = await dueEvent()
    try {
      const first = await db.rpc('claim_event_email').single()
      expect(first.error).toBeNull()
      const row = first.data!
      const payload = { subject: 'Frozen body' }
      await db
        .from('event_emails')
        .update({ payload, next_attempt_at: new Date(0).toISOString() })
        .eq('id', row.id)
      const retry = await db.rpc('claim_event_email').single()
      expect(retry.error).toBeNull()
      expect(retry.data?.id).toBe(row.id)
      expect(retry.data?.payload).toEqual(payload)
      await db
        .from('event_emails')
        .update({
          created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
          next_attempt_at: new Date(0).toISOString(),
        })
        .eq('id', row.id)
      const expired = await db.rpc('claim_event_email')
      expect(expired.error).toBeNull()
      expect(expired.data).toEqual([])
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('does not send an old queued email after the event is rescheduled', async () => {
    const event = await dueEvent()
    try {
      const first = await db.rpc('claim_event_email').single()
      expect(first.error).toBeNull()
      await db
        .from('events')
        .update({
          capture_end_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        })
        .eq('id', event.id)
      await db
        .from('event_emails')
        .update({ next_attempt_at: new Date(0).toISOString() })
        .eq('event_id', event.id)
      const next = await db.rpc('claim_event_email')
      expect(next.error).toBeNull()
      expect(next.data).toEqual([])
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('queues again for a new schedule and keeps the abandoned one as history', async () => {
    const event = await dueEvent()
    try {
      const first = await db.rpc('claim_event_email').single()
      expect(first.error).toBeNull()
      const original = first.data!
      expect(original.event_id).toBe(event.id)
      expect(original.kind).toBe('upcoming')

      // The mail went out for a date the host has since moved away from.
      // Rewriting scheduled_at is how the row looks once the reminder time
      // for the new date comes round: same event, same kind, other schedule.
      await db
        .from('event_emails')
        .update({
          sent_at: new Date().toISOString(),
          scheduled_at: new Date(Date.now() - 9 * 86400000).toISOString(),
        })
        .eq('id', original.id)

      const second = await db.rpc('claim_event_email').single()
      expect(second.error).toBeNull()
      expect(second.data?.event_id).toBe(event.id)
      expect(second.data?.kind).toBe('upcoming')
      expect(second.data?.id).not.toBe(original.id)
      // A fresh row, so a fresh body and a fresh Resend idempotency key.
      expect(second.data?.payload).toBeNull()
      expect(second.data?.attempts).toBe(1)

      // The sent one survives: what a host was told stays on the record.
      const { data: rows } = await db
        .from('event_emails')
        .select('id')
        .eq('event_id', event.id)
        .eq('kind', 'upcoming')
      expect(rows).toHaveLength(2)

      // …and the live schedule is still queued exactly once.
      await db
        .from('event_emails')
        .update({ next_attempt_at: new Date(0).toISOString() })
        .eq('id', second.data!.id)
      const third = await db.rpc('claim_event_email').single()
      expect(third.data?.id).toBe(second.data!.id)
      expect(third.data?.attempts).toBe(2)
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('refuses anon and host access to delivery records and claims', async () => {
    for (const client of [anonClient(), userClient(host.accessToken)]) {
      expect((await client.rpc('claim_event_email')).error).not.toBeNull()
      expect(
        (await client.from('event_emails').select('*')).error,
      ).not.toBeNull()
      expect(
        (
          await client
            .from('event_emails')
            .update({ sent_at: new Date().toISOString() })
            .eq('kind', 'ended')
        ).error,
      ).not.toBeNull()
    }
  })

  it('counts only received, non-deleted photos for the follow-up', async () => {
    const event = await dueEvent()
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Guest', session)
      await takeShot(event.id, session)
      const hidden = await takeShot(event.id, session)
      const deleted = await takeShot(event.id, session)
      await reserveShot(event.id, session)
      await db
        .from('photos')
        .update({ hidden_at: new Date().toISOString() })
        .eq('id', hidden!.photo_id!)
      await db
        .from('photos')
        .update({
          hidden_at: new Date().toISOString(),
          deleted_at: new Date().toISOString(),
        })
        .eq('id', deleted!.photo_id!)
      await db
        .from('events')
        .update({
          capture_end_at: new Date(Date.now() - 86400000).toISOString(),
        })
        .eq('id', event.id)
      const { data, error } = await db.rpc('claim_event_email').single()
      expect(error).toBeNull()
      expect(data?.kind).toBe('ended')
      expect(data?.snapshot).toMatchObject({
        photoCount: 2,
        recipient: host.email,
      })
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('skips historical events and events created after the reminder time', async () => {
    const event = await dueEvent()
    try {
      await db
        .from('events')
        .update({ created_at: new Date().toISOString() })
        .eq('id', event.id)
      expect((await db.rpc('claim_event_email')).data).toEqual([])
      await db
        .from('events')
        .update({
          capture_start_at: new Date(Date.now() - 40 * 86400000).toISOString(),
          capture_end_at: new Date(Date.now() - 30 * 86400000).toISOString(),
          created_at: new Date(Date.now() - 40 * 86400000).toISOString(),
        })
        .eq('id', event.id)
      expect((await db.rpc('claim_event_email')).data).toEqual([])
    } finally {
      await deleteEvent(event.id)
    }
  })
})
