import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  anonClient,
  createEvent,
  createUser,
  deleteEvent,
  deleteUser,
  serviceClient,
  type TestUser,
} from './harness'

/**
 * The export job's state machine, as `20260909110000_album_exports.sql`
 * defines it. Every transition here is one a worker, a page or the sweep
 * relies on, and the two that matter most are the ones that only a real
 * Postgres can prove: that concurrent claims hand out one job once, and that
 * a lapsed lease is released without the worker that held it.
 */

let host: TestUser

beforeAll(async () => {
  host = await createUser()
}, 60_000)

afterAll(async () => {
  if (host) await deleteUser(host.id)
})

const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)

async function request(eventId: string, hash = HASH_A) {
  const { data, error } = await serviceClient().rpc('request_album_export', {
    p_event_id: eventId,
    p_source_hash: hash,
    p_photo_count: 30,
    p_estimated_bytes: 60_000_000,
  })
  if (error) throw error
  return data
}

async function claim() {
  const { data, error } = await serviceClient().rpc('claim_album_export', {})
  if (error) throw error
  return data?.id ? data : null
}

async function row(id: string) {
  const { data, error } = await serviceClient()
    .from('album_exports')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

/** Move a lease into the past without waiting for it: what a dead worker
 *  looks like to the sweep. */
async function lapse(id: string) {
  const { error } = await serviceClient()
    .from('album_exports')
    .update({ locked_until: new Date(Date.now() - 1000).toISOString() })
    .eq('id', id)
  if (error) throw error
}

describe('requesting an export', () => {
  it('is idempotent while a job is in flight', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const first = await request(event.id)
      const second = await request(event.id)
      expect(first.status).toBe('queued')
      expect(second.id).toBe(first.id)

      // Two tabs, one tap each, at the same instant.
      const [a, b] = await Promise.all([request(event.id), request(event.id)])
      expect(a.id).toBe(first.id)
      expect(b.id).toBe(first.id)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('hands back a ready archive built from the same hash, and not another', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const job = await request(event.id, HASH_A)
      const claimed = await claim()
      expect(claimed?.id).toBe(job.id)
      const { error } = await serviceClient().rpc('complete_album_export', {
        p_id: job.id,
        p_storage_path: `${event.id}/${job.id}/ourfilm.zip`,
        p_byte_size: 1234,
      })
      expect(error).toBeNull()

      const again = await request(event.id, HASH_A)
      expect(again.id).toBe(job.id)
      expect(again.status).toBe('ready')

      // The album changed — a photo hidden, say — so the ZIP is stale.
      const fresh = await request(event.id, HASH_B)
      expect(fresh.id).not.toBe(job.id)
      expect(fresh.status).toBe('queued')
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('refuses an event that does not exist', async () => {
    const { error } = await serviceClient().rpc('request_album_export', {
      p_event_id: crypto.randomUUID(),
      p_source_hash: HASH_A,
      p_photo_count: 1,
      p_estimated_bytes: 1,
    })
    expect(error).not.toBeNull()
  })

  it('cannot be called with the anon key', async () => {
    const { error } = await anonClient().rpc('request_album_export', {
      p_event_id: crypto.randomUUID(),
      p_source_hash: HASH_A,
      p_photo_count: 1,
      p_estimated_bytes: 1,
    })
    expect(error).not.toBeNull()
    expect(error?.code).toBe('42501')
  })
})

describe('claiming', () => {
  it('gives one job to exactly one of several concurrent workers', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const job = await request(event.id)
      const results = await Promise.all(Array.from({ length: 6 }, claim))
      const winners = results.filter((r) => r?.id === job.id)
      expect(winners).toHaveLength(1)
      expect(winners[0]?.status).toBe('processing')
      expect(winners[0]?.attempt_count).toBe(1)
      expect(winners[0]?.locked_until).not.toBeNull()
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('skips a job whose retry is not due yet', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const job = await request(event.id)
      await claim()
      const { data: failed } = await serviceClient().rpc('fail_album_export', {
        p_id: job.id,
        p_code: 'fetch_failed',
        p_retry: true,
      })
      expect(failed?.status).toBe('queued')
      expect(failed?.next_attempt_at).not.toBeNull()
      // 30 seconds out: nobody should be able to claim it now.
      expect(await claim()).toBeNull()
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)
})

describe('the lease', () => {
  it('is extended by heartbeat and refused once it has lapsed', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const job = await request(event.id)
      await claim()
      const before = (await row(job.id)).locked_until!

      const { data: ok } = await serviceClient().rpc('heartbeat_album_export', {
        p_id: job.id,
        p_tus_upload_url: 'https://example.test/upload/1',
      })
      expect(ok).toBe(true)
      const after = await row(job.id)
      expect(Date.parse(after.locked_until!)).toBeGreaterThanOrEqual(
        Date.parse(before),
      )
      expect(after.tus_upload_url).toBe('https://example.test/upload/1')

      await lapse(job.id)
      const { data: late } = await serviceClient().rpc(
        'heartbeat_album_export',
        { p_id: job.id },
      )
      expect(late).toBe(false)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('is released by the sweep, back to the queue with the budget intact', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const job = await request(event.id)
      await claim()
      await lapse(job.id)

      const { data: swept, error } = await serviceClient()
        .rpc('sweep_album_exports')
        .single()
      expect(error).toBeNull()
      expect(swept?.released).toBeGreaterThanOrEqual(1)

      const after = await row(job.id)
      expect(after.status).toBe('queued')
      expect(after.last_error_code).toBe('lease_lost')
      expect(after.attempt_count).toBe(1)

      // And a fresh worker picks it straight up: the retry is due now.
      const again = await claim()
      expect(again?.id).toBe(job.id)
      expect(again?.attempt_count).toBe(2)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('fails a job whose fourth lease lapses', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const job = await request(event.id)
      for (let attempt = 1; attempt <= 4; attempt++) {
        const claimed = await claim()
        expect(claimed?.attempt_count).toBe(attempt)
        await lapse(job.id)
        await serviceClient().rpc('sweep_album_exports')
      }
      const after = await row(job.id)
      expect(after.status).toBe('failed')
      expect(after.last_error_code).toBe('lease_lost')
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)
})

describe('completing and failing', () => {
  it('marks ready with a 48-hour expiry', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const job = await request(event.id)
      await claim()
      const { data, error } = await serviceClient().rpc(
        'complete_album_export',
        {
          p_id: job.id,
          p_storage_path: `${event.id}/${job.id}/ourfilm.zip`,
          p_byte_size: 5_000_000,
          p_missing_count: 1,
        },
      )
      expect(error).toBeNull()
      expect(data?.status).toBe('ready')
      expect(data?.byte_size).toBe(5_000_000)
      expect(data?.missing_count).toBe(1)
      const hours =
        (Date.parse(data!.expires_at!) - Date.parse(data!.completed_at!)) /
        3_600_000
      expect(Math.round(hours)).toBe(48)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('refuses to complete a job that is not in progress', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const job = await request(event.id)
      // Never claimed: a worker that died and retried `complete` cannot talk
      // a queued row into `ready`.
      const { error } = await serviceClient().rpc('complete_album_export', {
        p_id: job.id,
        p_storage_path: 'x',
        p_byte_size: 1,
      })
      expect(error).not.toBeNull()
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('makes a permanent failure final and a transient one a retry', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const job = await request(event.id)
      await claim()
      const { data: retried } = await serviceClient().rpc('fail_album_export', {
        p_id: job.id,
        p_code: 'upload_failed',
        p_retry: true,
      })
      expect(retried?.status).toBe('queued')

      // Make it due now, claim again, and fail permanently.
      await serviceClient()
        .from('album_exports')
        .update({ next_attempt_at: new Date(0).toISOString() })
        .eq('id', job.id)
      await claim()
      const { data: final } = await serviceClient().rpc('fail_album_export', {
        p_id: job.id,
        p_code: 'zip_failed',
        p_retry: false,
      })
      expect(final?.status).toBe('failed')
      expect(final?.last_error_code).toBe('zip_failed')

      // …after which the host's next tap makes a fresh job.
      const fresh = await request(event.id)
      expect(fresh.id).not.toBe(job.id)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('expires a ready archive past its window', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const job = await request(event.id)
      await claim()
      await serviceClient().rpc('complete_album_export', {
        p_id: job.id,
        p_storage_path: 'x',
        p_byte_size: 1,
      })
      await serviceClient()
        .from('album_exports')
        .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
        .eq('id', job.id)
      const { data: swept } = await serviceClient()
        .rpc('sweep_album_exports')
        .single()
      expect(swept?.expired).toBeGreaterThanOrEqual(1)
      expect((await row(job.id)).status).toBe('expired')
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('goes with the event', async () => {
    // `on delete cascade`: a host deleting a wedding takes the job with it,
    // and the next status write from a worker affects zero rows.
    const event = await createEvent({ ownerId: host.id })
    const job = await request(event.id)
    await deleteEvent(event.id)
    const { data } = await serviceClient()
      .from('album_exports')
      .select('id')
      .eq('id', job.id)
    expect(data ?? []).toHaveLength(0)
  }, 60_000)
})

describe('the schedule', () => {
  it('is installed by the migration', async () => {
    const { data, error } = await serviceClient().rpc('album_export_cron_jobs')
    expect(error).toBeNull()
    expect(data?.map((j) => [j.jobname, j.schedule, j.active])).toEqual([
      ['album-exports-sweep-http', '*/5 * * * *', true],
      ['album-exports-sweep-sql', '* * * * *', true],
    ])
  })
})
