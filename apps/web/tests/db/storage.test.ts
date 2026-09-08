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
 * The photo bucket, public again.
 *
 * It was private from August to September 2026, with every read signed. That
 * over-credited the bucket: the reveal is enforced by `event_gallery_by_slug`
 * withholding paths, and signing them afterwards guarded a 122-bit uuid path
 * behind a slug that had already let the visitor in, at the cost of a Storage
 * round trip per grid and a URL no other viewer's cache could hit. See
 * `20260908120000_public_photo_bucket.sql` and
 * docs/public-cdn-and-export-worker.md for the trade.
 *
 * `public` governs one thing: anonymous read of a *known* object. The half of
 * the model that must not move is pinned below — anon cannot write, anon
 * cannot list, and a host cannot list another host's folder. Deleting the
 * `describe('the bucket')` block to make a red test go away is the failure
 * mode this file exists to catch.
 *
 * Guests never write to Storage with the anon key at all. Every upload goes to
 * a signed URL minted by `reserve_shot`'s server action, bound to one exact
 * path the database has already agreed to.
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
  it('is public', async () => {
    const { data, error } = await serviceClient().storage.getBucket(BUCKET)
    expect(error).toBeNull()
    expect(data?.public).toBe(true)
  })

  it('serves a known object over the public route, with no credential', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const path = `${event.id}/probe.jpg`
      await serviceClient().storage.from(BUCKET).upload(path, JPEG, {
        contentType: 'image/jpeg',
        upsert: true,
      })

      // Exactly the URL `publicPhotoUrl()` builds, fetched the way a guest's
      // browser fetches it: no apikey, no Authorization, no token.
      const response = await fetch(
        `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`,
      )
      expect(response.ok).toBe(true)
      expect(response.headers.get('content-type')).toBe('image/jpeg')
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('is the same URL for every viewer', async () => {
    // The whole reason the bucket is public: one cache key per object. A
    // signed URL differs per mint, which is what this pins against.
    const { publicPhotoUrl } = await import('@/lib/photo-urls')
    const path = `${crypto.randomUUID()}/${crypto.randomUUID()}_thumb.jpg`
    expect(publicPhotoUrl(path)).toBe(publicPhotoUrl(path))
    expect(publicPhotoUrl(path)).not.toContain('token=')
  })
})

describe('guests and storage', () => {
  it('cannot upload with the anon key', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      // There is no anon insert policy. Without that, a guest could fill the
      // bucket with objects no row references — which is what gating only the
      // `photos` table would have allowed. A public bucket changes nothing
      // here: `public` is about reading a known object, not writing one.
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

      // There is deliberately no select policy for anon. On a public bucket
      // this is the *only* thing standing between "anyone holding this exact
      // URL may GET it" and "anyone may find out what URLs exist": a select
      // policy scoped to the bucket would let anyone walk every event id and
      // photo id in the system.
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

  it('cannot list an event folder it knows the id of, either', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      await serviceClient()
        .storage.from(BUCKET)
        .upload(`${event.id}/probe.jpg`, JPEG, {
          contentType: 'image/jpeg',
          upsert: true,
        })

      // The sharper version of the test above. A guest *does* learn their own
      // event id from the page, and the folder is that id — so this is the
      // exact request that would turn one album's id into every photo path in
      // it, including the ones the reveal is still withholding.
      const response = await fetch(
        `${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`,
        {
          method: 'POST',
          headers: {
            apikey: ANON_KEY,
            Authorization: `Bearer ${ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prefix: event.id, limit: 100 }),
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

      // The delete path runs on the host's own session rather than the
      // service key, so this policy is what makes it work.
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
