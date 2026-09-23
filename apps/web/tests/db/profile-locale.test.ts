import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  anonClient,
  createEvent,
  createUser,
  deleteEvent,
  deleteUser,
  serviceClient,
  userClient,
  type TestUser,
} from './harness'

const db = serviceClient()

async function profileLocale(id: string) {
  const { data, error } = await db
    .from('profiles')
    .select('locale')
    .eq('id', id)
    .single()
  if (error) throw error
  return data.locale
}

describe('host profile language', () => {
  let host: TestUser
  beforeAll(async () => {
    host = await createUser()
  }, 60_000)
  afterAll(async () => {
    if (host) await deleteUser(host.id)
  })

  it('takes the sign-up language from user metadata, and nothing else', async () => {
    const ids: string[] = []
    try {
      for (const metadata of [{ locale: 'en' }, { locale: 'de' }, {}]) {
        const { data, error } = await db.auth.admin.createUser({
          email: `locale-${randomUUID().slice(0, 8)}@example.invalid`,
          email_confirm: true,
          user_metadata: metadata,
        })
        if (error || !data.user) throw error ?? new Error('no user')
        ids.push(data.user.id)
      }
      expect(await profileLocale(ids[0])).toBe('en')
      expect(await profileLocale(ids[1])).toBeNull()
      expect(await profileLocale(ids[2])).toBeNull()
    } finally {
      for (const id of ids) await deleteUser(id)
    }
  })

  it('lets a host set their own language, and the callback only fill a gap', async () => {
    const client = userClient(host.accessToken)

    // The sign-in callback's form: records an arrival language once.
    await client.rpc('set_host_locale', {
      p_locale: 'hu',
      p_only_if_unset: true,
    })
    expect(await profileLocale(host.id)).toBe('hu')
    await client.rpc('set_host_locale', {
      p_locale: 'en',
      p_only_if_unset: true,
    })
    expect(await profileLocale(host.id)).toBe('hu')

    // The account screen's form: a deliberate choice always wins.
    const { error } = await client.rpc('set_host_locale', { p_locale: 'en' })
    expect(error).toBeNull()
    expect(await profileLocale(host.id)).toBe('en')

    const refused = await client.rpc('set_host_locale', { p_locale: 'de' })
    expect(refused.error).not.toBeNull()
    expect(await profileLocale(host.id)).toBe('en')
  })

  it('is not writable anonymously', async () => {
    const { error } = await anonClient().rpc('set_host_locale', {
      p_locale: 'en',
    })
    expect(error).not.toBeNull()
  })

  it('sends host mail in the profile language, not the event’s', async () => {
    await userClient(host.accessToken).rpc('set_host_locale', {
      p_locale: 'en',
    })
    const event = await createEvent({ ownerId: host.id })
    try {
      await db.from('events').update({ locale: 'hu' }).eq('id', event.id)

      // The creation confirmation is queued by the insert; claim until it
      // is this event's (other suites may leave mail in the local outbox).
      let snapshot: Record<string, unknown> | null = null
      for (let i = 0; i < 20 && !snapshot; i += 1) {
        const { data, error } = await db.rpc('claim_event_email')
        if (error) throw error
        if (!data?.length) break
        const mine = data.find((row) => row.event_id === event.id)
        if (mine) snapshot = mine.snapshot as Record<string, unknown>
      }
      expect(snapshot).toMatchObject({ locale: 'en' })
    } finally {
      await deleteEvent(event.id)
    }
  })
})
