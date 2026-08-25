import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ANON_KEY,
  SUPABASE_URL,
  createEvent,
  createUser,
  deleteEvent,
  deleteUser,
  joinEvent,
  newSession,
  reserveShot,
  serviceClient,
  type TestUser,
} from './harness'

/**
 * The photo bucket, now private.
 *
 * It used to be public, and privacy came from the two unguessable uuids in the
 * path. That was a fair bet for an album with no reveal and an untenable one
 * now: a public object URL keeps working forever regardless of what the reveal
 * predicate says, so "nobody sees these until the album develops" could not
 * have been kept by a URL anyone could hold.
 *
 * Guests also no longer write to Storage with the anon key at all. Every upload
 * goes to a signed URL minted by `reserve_shot`'s server action, bound to one
 * exact path the database has already agreed to.
 */

const BUCKET = 'event-photos'

let host: TestUser

beforeAll(async () => {
  host = await createUser()
}, 60_000)

afterAll(async () => {
  if (host) await deleteUser(host.id)
})

const JPEG = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43])], {
  type: 'image/jpeg',
})

describe('the bucket', () => {
  it('is private', async () => {
    const { data, error } = await serviceClient().storage.getBucket(BUCKET)
    expect(error).toBeNull()
    expect(data?.public).toBe(false)
  })

  it('does not serve objects over the public route', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const path = `${event.id}/probe.jpg`
      await serviceClient().storage.from(BUCKET).upload(path, JPEG, {
        contentType: 'image/jpeg',
        upsert: true,
      })

      // The exact URL the old `photoPublicUrl()` built. It must not resolve
      // any more — this is the assertion that the reveal is a property of the
      // system rather than a UI state.
      const response = await fetch(
        `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`,
      )
      expect(response.ok).toBe(false)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('serves an object through a signed URL', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const path = `${event.id}/probe.jpg`
      const db = serviceClient()
      await db.storage
        .from(BUCKET)
        .upload(path, JPEG, { contentType: 'image/jpeg', upsert: true })

      const { data, error } = await db.storage
        .from(BUCKET)
        .createSignedUrl(path, 60)
      expect(error).toBeNull()

      const response = await fetch(data!.signedUrl)
      expect(response.ok).toBe(true)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)
})

describe('guests and storage', () => {
  it('cannot upload with the anon key', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      // The anon insert policy is gone. Without it a guest could fill the
      // bucket with objects no row references — which is what gating only the
      // `photos` table would have allowed.
      const response = await fetch(
        `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${event.id}/forged.jpg`,
        {
          method: 'POST',
          headers: {
            apikey: ANON_KEY,
            Authorization: `Bearer ${ANON_KEY}`,
            'Content-Type': 'image/jpeg',
          },
          body: JPEG,
        },
      )
      expect(response.ok).toBe(false)

      const { data } = await serviceClient().storage.from(BUCKET).list(event.id)
      expect(data ?? []).toHaveLength(0)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('cannot list the bucket with the anon key', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      await serviceClient()
        .storage.from(BUCKET)
        .upload(`${event.id}/probe.jpg`, JPEG, {
          contentType: 'image/jpeg',
          upsert: true,
        })

      // There is deliberately no select policy for anon. One scoped to the
      // bucket would let anyone walk every event id and photo id in the system,
      // which is the same enumeration hole the table policies avoid.
      const response = await fetch(
        `${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`,
        {
          method: 'POST',
          headers: {
            apikey: ANON_KEY,
            Authorization: `Bearer ${ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prefix: '', limit: 100 }),
        },
      )

      const listed = response.ok ? await response.json() : []
      expect(Array.isArray(listed) ? listed : []).toHaveLength(0)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('can upload to a signed URL for a reserved frame', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)
      const reserved = await reserveShot(event.id, session)

      // Exactly what `lib/capture.ts` mints and `lib/upload-shot.ts` redeems.
      const db = serviceClient()
      const { data: signed, error: signError } = await db.storage
        .from(BUCKET)
        .createSignedUploadUrl(reserved!.storage_path as string, {
          upsert: true,
        })
      expect(signError).toBeNull()

      const guest = (await import('@supabase/supabase-js')).createClient(
        SUPABASE_URL,
        ANON_KEY,
        { auth: { persistSession: false } },
      )
      const { error: uploadError } = await guest.storage
        .from(BUCKET)
        .uploadToSignedUrl(signed!.path, signed!.token, JPEG, {
          contentType: 'image/jpeg',
        })

      expect(uploadError).toBeNull()

      const { data: listed } = await db.storage.from(BUCKET).list(event.id)
      expect(listed ?? []).toHaveLength(1)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)
})

describe('hosts and storage', () => {
  it('cannot read another host through a bucket listing', async () => {
    const stranger = await createUser()
    const event = await createEvent({ ownerId: host.id })
    try {
      await serviceClient()
        .storage.from(BUCKET)
        .upload(`${event.id}/probe.jpg`, JPEG, {
          contentType: 'image/jpeg',
          upsert: true,
        })

      const { createClient } = await import('@supabase/supabase-js')
      const other = createClient(SUPABASE_URL, ANON_KEY, {
        auth: { persistSession: false },
        global: {
          headers: { Authorization: `Bearer ${stranger.accessToken}` },
        },
      })

      const { data } = await other.storage.from(BUCKET).list(event.id)
      expect(data ?? []).toHaveLength(0)
    } finally {
      await deleteEvent(event.id)
      await deleteUser(stranger.id)
    }
  }, 60_000)

  it('can list its own event folder', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      await serviceClient()
        .storage.from(BUCKET)
        .upload(`${event.id}/probe.jpg`, JPEG, {
          contentType: 'image/jpeg',
          upsert: true,
        })

      // The ZIP export and the delete path both run on the host's own session
      // rather than the service key, so this policy is what makes them work.
      const { createClient } = await import('@supabase/supabase-js')
      const owner = createClient(SUPABASE_URL, ANON_KEY, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${host.accessToken}` } },
      })

      const { data, error } = await owner.storage.from(BUCKET).list(event.id)
      expect(error).toBeNull()
      expect(data ?? []).toHaveLength(1)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)
})
