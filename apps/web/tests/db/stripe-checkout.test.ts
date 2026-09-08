import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  anonClient,
  createEvent,
  createUser,
  deleteEvent,
  deleteUser,
  markPaid,
  serviceClient,
  userClient,
  type TestUser,
} from './harness'

let host: TestUser
let stranger: TestUser

beforeAll(async () => {
  ;[host, stranger] = await Promise.all([createUser(), createUser()])
}, 60_000)

afterAll(async () => {
  await Promise.all(
    [host, stranger].filter(Boolean).map((user) => deleteUser(user.id)),
  )
})

describe('Stripe checkout attempt reservation', () => {
  it('gives concurrent requests one idempotency attempt', async () => {
    const event = await createEvent({ ownerId: host.id })
    const db = userClient(host.accessToken)
    try {
      const firstAcceptance = new Date().toISOString()
      const secondAcceptance = new Date(Date.now() + 1_000).toISOString()
      const [first, second] = await Promise.all([
        db
          .rpc('reserve_event_checkout', {
            p_event_id: event.id,
            p_terms_accepted_at: firstAcceptance,
            p_ttl_seconds: 2700,
          })
          .single(),
        db
          .rpc('reserve_event_checkout', {
            p_event_id: event.id,
            p_terms_accepted_at: secondAcceptance,
            p_ttl_seconds: 2700,
          })
          .single(),
      ])

      if (first.error) throw first.error
      if (second.error) throw second.error

      expect(first.data.attempt_id).toBe(second.data.attempt_id)
      expect(first.data.expires_at).toBe(second.data.expires_at)
      expect(first.data.terms_accepted_at).toBe(second.data.terms_accepted_at)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('rotates the attempt only after its reservation expires', async () => {
    const event = await createEvent({ ownerId: host.id })
    const hostDb = userClient(host.accessToken)
    try {
      const original = await hostDb
        .rpc('reserve_event_checkout', {
          p_event_id: event.id,
          p_terms_accepted_at: new Date().toISOString(),
          p_ttl_seconds: 2700,
        })
        .single()
      if (original.error) throw original.error

      const forcedExpiry = '2000-01-01T00:00:00.000Z'
      const expiryUpdate = await serviceClient()
        .from('stripe_checkout_attempts')
        .update({ expires_at: forcedExpiry })
        .eq('event_id', event.id)
        .select('expires_at')
        .single()
      if (expiryUpdate.error) throw expiryUpdate.error
      expect(new Date(expiryUpdate.data.expires_at).getTime()).toBe(
        new Date(forcedExpiry).getTime(),
      )

      const replacementAcceptance = new Date().toISOString()
      const replacement = await hostDb
        .rpc('reserve_event_checkout', {
          p_event_id: event.id,
          p_terms_accepted_at: replacementAcceptance,
          p_ttl_seconds: 2700,
        })
        .single()
      if (replacement.error) throw replacement.error

      expect(replacement.data.attempt_id).not.toBe(original.data.attempt_id)
      expect(new Date(replacement.data.expires_at).getTime()).toBeGreaterThan(
        Date.now(),
      )
      expect(new Date(replacement.data.terms_accepted_at).getTime()).toBe(
        new Date(replacementAcceptance).getTime(),
      )
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('does not expose or reserve attempts for another host', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const otherHost = userClient(stranger.accessToken)
      const { error } = await otherHost.rpc('reserve_event_checkout', {
        p_event_id: event.id,
        p_terms_accepted_at: new Date().toISOString(),
        p_ttl_seconds: 2700,
      })
      expect(error).toBeTruthy()

      const { data } = await otherHost
        .from('stripe_checkout_attempts')
        .select('*')
      expect(data ?? []).toHaveLength(0)

      const anonymous = await anonClient().rpc('reserve_event_checkout', {
        p_event_id: event.id,
        p_terms_accepted_at: new Date().toISOString(),
        p_ttl_seconds: 2700,
      })
      expect(anonymous.error).toBeTruthy()
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('refuses a new attempt after the event is paid', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      await markPaid(event.id, host.id)

      const { error } = await userClient(host.accessToken).rpc(
        'reserve_event_checkout',
        {
          p_event_id: event.id,
          p_terms_accepted_at: new Date().toISOString(),
          p_ttl_seconds: 2700,
        },
      )

      expect(error).toBeTruthy()
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)
})
