import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  anonClient,
  userClient,
  serviceClient,
  createUser,
  deleteUser,
  createEvent,
  deleteEvent,
  joinEvent,
  newSession,
  reserveShot,
  commitShot,
  countPhotos,
  type TestUser,
} from './harness'

const HOUR = 3600_000
let host: TestUser
beforeAll(async () => {
  host = await createUser()
}, 60_000)
afterAll(async () => {
  if (host) await deleteUser(host.id)
})

async function fixture(enabled = true, hoursSinceEnd = 1, shots = 36) {
  const end = new Date(Date.now() - hoursSinceEnd * HOUR)
  const event = await createEvent({
    ownerId: host.id,
    captureStartAt: new Date(end.getTime() - 4 * HOUR),
    captureEndAt: end,
    shotsPerParticipant: shots,
    revealMode: 'event_end',
  })
  const session = newSession()
  const participant = await joinEvent(event.slug, 'Réka', session)
  const db = serviceClient()
  const changes = await Promise.all([
    db
      .from('events')
      .update({ post_event_uploads_enabled: enabled })
      .eq('id', event.id),
    db
      .from('participants')
      .update({ joined_at: new Date(end.getTime() - HOUR).toISOString() })
      .eq('id', participant!.participant_id),
  ])
  changes.forEach(({ error }) => {
    if (error) throw error
  })
  return { event, session, end }
}

async function late(
  eventId: string,
  session: ReturnType<typeof newSession>,
  key = randomUUID(),
  started = new Date(),
) {
  const { data, error } = await serviceClient()
    .rpc('reserve_shot', {
      p_event_id: eventId,
      p_token_hash: session.hash,
      p_idempotency_key: key,
      p_capture_started_at: started.toISOString(),
      p_source: 'post_event',
    })
    .single()
  if (error) throw error
  return data
}

/** Push reservations past `shot_reservation_ttl()` without waiting it out. */
async function expire(ids: string[]) {
  const { error } = await serviceClient()
    .from('photos')
    .update({
      created_at: new Date(Date.now() - HOUR).toISOString(),
      reserved_at: null,
    })
    .in('id', ids)
  if (error) throw error
}

async function state(slug: string, session: ReturnType<typeof newSession>) {
  const { data, error } = await serviceClient()
    .rpc('event_guest_state', { p_slug: slug, p_token_hash: session.hash })
    .single()
  if (error) throw error
  return data
}

describe('after-event uploads', () => {
  it('defaults off and only the owning host can change the option', async () => {
    const event = await createEvent({ ownerId: host.id })
    const other = await createUser()
    try {
      const read = () =>
        serviceClient()
          .from('events')
          .select('post_event_uploads_enabled')
          .eq('id', event.id)
          .single()
      expect((await read()).data?.post_event_uploads_enabled).toBe(false)
      await userClient(other.accessToken)
        .from('events')
        .update({ post_event_uploads_enabled: true })
        .eq('id', event.id)
      await anonClient()
        .from('events')
        .update({ post_event_uploads_enabled: true })
        .eq('id', event.id)
      expect((await read()).data?.post_event_uploads_enabled).toBe(false)
      const { error } = await userClient(host.accessToken)
        .from('events')
        .update({ post_event_uploads_enabled: true })
        .eq('id', event.id)
      expect(error).toBeNull()
      expect((await read()).data?.post_event_uploads_enabled).toBe(true)
    } finally {
      await deleteEvent(event.id)
      await deleteUser(other.id)
    }
  })

  it('keeps the same returning participant, remaining roll and reveal time', async () => {
    const { event, session, end } = await fixture()
    try {
      const before = await state(event.slug, session)
      const shot = await late(event.id, session)
      expect(shot.refusal).toBeNull()
      // How late it is, for telemetry — but no device claim: this is not a
      // recovered camera capture, and `capture.ts` keeps it out of the grace
      // report by the source it sent.
      expect(shot.late_seconds).toBeGreaterThanOrEqual(3600)
      expect(shot.claimed_lead_seconds).toBeNull()
      await commitShot(shot.photo_id, session)
      const after = await state(event.slug, session)
      expect(after.participant_id).toBe(before.participant_id)
      expect(after.shots_remaining).toBe(35)
      expect(Date.parse(after.reveal_at)).toBe(end.getTime())
      expect(after.can_guest_view_gallery).toBe(true)
      expect(after.photo_count).toBe(1)
    } finally {
      await deleteEvent(event.id)
    }
  })

  it.each([false, true])(
    'keeps camera recovery independent of the option (%s)',
    async (enabled) => {
      const { event, session, end } = await fixture(enabled)
      try {
        const result = await reserveShot(
          event.id,
          session,
          randomUUID(),
          new Date(end.getTime() - 60_000),
        )
        expect(result?.refusal).toBeNull()
        if (!enabled)
          expect((await late(event.id, session)).refusal).toBe('ended')
      } finally {
        await deleteEvent(event.id)
      }
    },
  )

  it.each([0, -1, 24, 25])(
    'refuses new gallery uploads outside the window (%s hours after end)',
    async (hours) => {
      // Zero is tested with the end in the near future; exact display boundaries
      // are covered by the pure predicate tests.
      const { event, session, end } = await fixture(
        true,
        hours === 0 ? -0.01 : hours,
      )
      try {
        expect(
          (
            await late(
              event.id,
              session,
              randomUUID(),
              new Date(end.getTime() - HOUR),
            )
          ).refusal,
        ).toBe('ended')
        expect(await countPhotos(event.id)).toBe(0)
      } finally {
        await deleteEvent(event.id)
      }
    },
  )

  it('admits a guest who first joins after the close, and refuses strangers and direct API callers', async () => {
    const { event, session, end } = await fixture()
    try {
      // Never scanned at the party: the gallery window is for them too, but
      // the camera grace still is not.
      const latecomer = newSession()
      await joinEvent(event.slug, 'Másnap', latecomer)
      const lateKey = randomUUID()
      const admitted = await late(event.id, latecomer, lateKey)
      expect(admitted.refusal).toBeNull()
      expect(admitted.shots_remaining).toBe(35)
      // A new gallery reservation says how late it is and makes no device
      // claim; its replay says neither, so telemetry counts it once.
      expect(admitted.late_seconds).toBeGreaterThanOrEqual(3600)
      expect(admitted.claimed_lead_seconds).toBeNull()
      const replayed = await late(event.id, latecomer, lateKey)
      expect(replayed.photo_id).toBe(admitted.photo_id)
      expect(replayed.late_seconds).toBeNull()
      expect(
        (await reserveShot(
          event.id,
          latecomer,
          randomUUID(),
          new Date(end.getTime() - 60_000),
        ))!.refusal,
      ).toBe('ended')
      expect((await late(event.id, newSession())).refusal).toBe('no_session')
      for (const client of [anonClient(), userClient(host.accessToken)]) {
        const { error } = await client.rpc('reserve_shot', {
          p_event_id: event.id,
          p_token_hash: session.hash,
          p_idempotency_key: randomUUID(),
          p_capture_started_at: new Date().toISOString(),
          p_source: 'post_event',
        })
        expect(error).not.toBeNull()
        expect(
          (
            await client.rpc('release_shot_by_capture', {
              p_event_id: event.id,
              p_token_hash: session.hash,
              p_idempotency_key: 'unknown',
            })
          ).error,
        ).not.toBeNull()
      }
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('admits only eight more after 28 shots, and an expired reservation cannot overtake them', async () => {
    const { event, session, end } = await fixture()
    try {
      for (let i = 0; i < 27; i++) {
        const shot = await reserveShot(
          event.id,
          session,
          randomUUID(),
          new Date(end.getTime() - 60_000),
        )
        await commitShot(shot!.photo_id, session)
      }
      const staleKey = randomUUID()
      const stale = await reserveShot(
        event.id,
        session,
        staleKey,
        new Date(end.getTime() - 60_000),
      )
      await expire([stale!.photo_id])
      // Expired, so it holds no frame: 27 used.
      const key = randomUUID()
      const duplicate = await Promise.all(
        Array.from({ length: 6 }, () => late(event.id, session, key)),
      )
      expect(new Set(duplicate.map((row) => row.photo_id)).size).toBe(1)
      const more = await Promise.all(
        Array.from({ length: 12 }, () => late(event.id, session)),
      )
      expect(more.filter((row) => !row.refusal)).toHaveLength(8)
      expect(more.filter((row) => row.refusal === 'no_shots')).toHaveLength(4)

      // The roll is full, so the expired row can come back by neither door.
      expect((await late(event.id, session, staleKey)).refusal).toBe('no_shots')
      const direct = await commitShot(stale!.photo_id, session)
      expect(direct).toMatchObject({ committed: false, refusal: 'no_shots' })

      await Promise.all(
        [
          duplicate[0].photo_id,
          ...more.filter((row) => !row.refusal).map((row) => row.photo_id),
        ].map((id) => commitShot(id, session)),
      )
      expect(await countPhotos(event.id, 'ready')).toBe(36)
      expect((await state(event.slug, session)).shots_remaining).toBe(0)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('lets an expired reservation re-claim a free frame on replay, and holds it again', async () => {
    const { event, session } = await fixture()
    try {
      const key = randomUUID()
      const shot = await late(event.id, session, key)
      await expire([shot.photo_id])
      expect((await state(event.slug, session)).shots_remaining).toBe(36)

      const replay = await late(event.id, session, key)
      expect(replay.photo_id).toBe(shot.photo_id)
      expect(replay.refusal).toBeNull()
      expect((await state(event.slug, session)).shots_remaining).toBe(35)

      // `created_at` is the export's sort fallback; a resume must not move it.
      const { data } = await serviceClient()
        .from('photos')
        .select('created_at, reserved_at')
        .eq('id', shot.photo_id)
        .single()
      expect(Date.parse(data!.created_at)).toBeLessThan(Date.now() - HOUR / 2)
      expect(data!.reserved_at).not.toBeNull()

      expect(await commitShot(shot.photo_id, session)).toMatchObject({
        committed: true,
        shots_remaining: 35,
      })
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('never lets a waited-out roll commit twice over', async () => {
    const { event, session } = await fixture(true, 1, 5)
    try {
      const first = await Promise.all(
        Array.from({ length: 5 }, () => late(event.id, session)),
      )
      await expire(first.map((row) => row.photo_id))
      const second = await Promise.all(
        Array.from({ length: 5 }, () => late(event.id, session)),
      )
      expect(second.every((row) => !row.refusal)).toBe(true)

      const commits = await Promise.all(
        [...first, ...second].map((row) => commitShot(row.photo_id, session)),
      )
      expect(commits.filter((row) => row!.committed)).toHaveLength(5)
      expect(commits.filter((row) => row!.refusal === 'no_shots')).toHaveLength(
        5,
      )
      expect(await countPhotos(event.id, 'ready')).toBe(5)
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('finishes accepted keys after disable and expiry, without changing a delayed reveal', async () => {
    const { event, session } = await fixture()
    try {
      const key = randomUUID()
      const shot = await late(event.id, session, key)
      const reveal = new Date(Date.now() + 48 * HOUR).toISOString()
      const { error } = await serviceClient()
        .from('events')
        .update({
          post_event_uploads_enabled: false,
          capture_start_at: new Date(Date.now() - 30 * HOUR).toISOString(),
          capture_end_at: new Date(Date.now() - 25 * HOUR).toISOString(),
          reveal_mode: 'custom',
          reveal_at: reveal,
        })
        .eq('id', event.id)
      expect(error).toBeNull()
      const replay = await late(event.id, session, key)
      expect(replay.photo_id).toBe(shot.photo_id)
      expect(replay.refusal).toBeNull()
      await Promise.all([
        commitShot(shot.photo_id, session),
        commitShot(shot.photo_id, session),
      ])
      expect(await countPhotos(event.id)).toBe(1)
      expect((await late(event.id, session)).refusal).toBe('ended')
      const after = await state(event.slug, session)
      expect(after.can_guest_view_gallery).toBe(false)
      expect(Date.parse(after.reveal_at)).toBe(Date.parse(reveal))
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('releases a discarded capture by key but never deletes a committed photo', async () => {
    const { event, session } = await fixture()
    try {
      const key = randomUUID()
      const release = () =>
        serviceClient().rpc('release_shot_by_capture', {
          p_event_id: event.id,
          p_token_hash: session.hash,
          p_idempotency_key: key,
        })
      await late(event.id, session, key)
      expect((await release()).error).toBeNull()
      expect((await state(event.slug, session)).shots_remaining).toBe(36)
      const shot = await late(event.id, session, key)
      await commitShot(shot.photo_id, session)
      await release()
      expect(await countPhotos(event.id, 'ready')).toBe(1)
    } finally {
      await deleteEvent(event.id)
    }
  })
})
