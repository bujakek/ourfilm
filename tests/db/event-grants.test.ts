import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  anonClient,
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
  userClient,
  type TestUser,
} from './harness'

/**
 * Comped events: the Early Couple Program's entitlement, and the operator's
 * manual lever.
 *
 * Two properties worth a real Postgres. First, that a grant actually lifts the
 * cap inside `join_event` — the sixth guest is refused by a `security definer`
 * function under a row lock, and nothing in TypeScript can prove that clause
 * fires. Second, that `event_grants` is unreachable from a browser key: it is
 * an entitlement table with no RLS policies, and the codebase has already been
 * bitten once by `revoke ... from public` leaving Supabase's direct grants to
 * `anon` and `authenticated` in place.
 */

let host: TestUser

beforeAll(async () => {
  host = await createUser()
}, 60_000)

afterAll(async () => {
  if (host) await deleteUser(host.id)
})

async function planSource(eventId: string) {
  const { data, error } = await serviceClient()
    .rpc('event_participant_quota', { p_event_id: eventId })
    .maybeSingle()
  if (error) throw error
  return data?.plan_source ?? null
}

async function grant(slug: string, reason: 'early_couple' | 'operator') {
  const { data, error } = await serviceClient()
    .rpc('grant_event_plan', { p_event_slug: slug, p_reason: reason })
    .maybeSingle()
  if (error) throw error
  return data
}

describe('a granted event', () => {
  it('admits a sixth guest the free cap would have refused', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      for (let i = 0; i < 5; i++) {
        await joinEvent(event.slug, `Vendég ${i}`, newSession())
      }

      const refused = await joinEvent(event.slug, 'Hatodik', newSession())
      expect(refused?.cap_reached).toBe(true)

      await grant(event.slug, 'early_couple')

      const admitted = await joinEvent(event.slug, 'Hatodik', newSession())
      expect(admitted?.cap_reached).toBe(false)
      expect(admitted?.participant_id).toBeTruthy()
      expect(await countParticipants(event.id)).toBe(6)
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('reports its own reason rather than a payment', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      expect(await planSource(event.id)).toBeNull()

      await grant(event.slug, 'early_couple')
      expect(await planSource(event.id)).toBe('early_couple')
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('distinguishes an operator unlock', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      await grant(event.slug, 'operator')
      expect(await planSource(event.id)).toBe('operator')
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('is superseded by a real payment, which has the receipt', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      await grant(event.slug, 'early_couple')
      await markPaid(event.id, host.id)

      // A couple who was comped and paid anyway must read as paid: that is the
      // one reason with an amount behind it.
      expect(await planSource(event.id)).toBe('paid')
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('still reports admin ownership when it has no grant', async () => {
    const operator = await createUser()
    await makeAdmin(operator.id)
    const event = await createEvent({ ownerId: operator.id })
    try {
      expect(await planSource(event.id)).toBe('admin')
    } finally {
      await deleteEvent(event.id)
      await deleteUser(operator.id)
    }
  })
})

describe('granting', () => {
  it('is idempotent', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const first = await grant(event.slug, 'early_couple')
      const second = await grant(event.slug, 'early_couple')

      expect(first?.already_active).toBe(false)
      expect(second?.already_active).toBe(true)
      expect(second?.grant_id).toBe(first?.grant_id)

      const { count } = await serviceClient()
        .from('event_grants')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event.id)
      expect(count).toBe(1)
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('survives concurrent attempts without double-granting', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      // The partial unique index is the only thing standing between two
      // simultaneous runs and two active grants for one event.
      await Promise.all(
        Array.from({ length: 5 }, () => grant(event.slug, 'early_couple')),
      )

      const { count } = await serviceClient()
        .from('event_grants')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .is('revoked_at', null)
      expect(count).toBe(1)
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('refuses an unknown slug', async () => {
    const { error } = await serviceClient().rpc('grant_event_plan', {
      p_event_slug: 'no-such-event-anywhere',
      p_reason: 'early_couple',
    })
    expect(error).toBeTruthy()
  })

  it('refuses a reason outside the vocabulary', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const { error } = await serviceClient().rpc('grant_event_plan', {
        p_event_slug: event.slug,
        p_reason: 'because_i_said_so',
      })
      expect(error).toBeTruthy()
      expect(await planSource(event.id)).toBeNull()
    } finally {
      await deleteEvent(event.id)
    }
  })
})

describe('revoking', () => {
  it('restores the cap and keeps the row', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      await grant(event.slug, 'operator')
      expect(await planSource(event.id)).toBe('operator')

      const { data: revoked, error } = await serviceClient().rpc(
        'revoke_event_plan',
        { p_event_slug: event.slug, p_note: 'test' },
      )
      if (error) throw error
      expect(revoked).toBe(true)
      expect(await planSource(event.id)).toBeNull()

      // A ledger, not a delete: the history of the comp survives.
      const { data: rows } = await serviceClient()
        .from('event_grants')
        .select('id, revoked_at')
        .eq('event_id', event.id)
      expect(rows).toHaveLength(1)
      expect(rows?.[0].revoked_at).toBeTruthy()
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('reports when there was nothing to revoke', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const { data } = await serviceClient().rpc('revoke_event_plan', {
        p_event_slug: event.slug,
      })
      expect(data).toBe(false)
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('allows the event to be granted again afterwards', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      await grant(event.slug, 'early_couple')
      await serviceClient().rpc('revoke_event_plan', {
        p_event_slug: event.slug,
      })

      // The partial index must not make a revoked grant block a new one.
      const again = await grant(event.slug, 'early_couple')
      expect(again?.already_active).toBe(false)
      expect(await planSource(event.id)).toBe('early_couple')
    } finally {
      await deleteEvent(event.id)
    }
  })
})

describe('the browser keys', () => {
  it('cannot read grants, sign in or not', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      await grant(event.slug, 'early_couple')

      const { data: anonRows } = await anonClient()
        .from('event_grants')
        .select('id')
      expect(anonRows ?? []).toHaveLength(0)

      // The host owns this event, and still must not see the table.
      const { data: hostRows } = await userClient(host.accessToken)
        .from('event_grants')
        .select('id')
      expect(hostRows ?? []).toHaveLength(0)
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('cannot grant themselves anything', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      // Both doors: the table and the RPC. Asserting on the error alone would
      // not do — RLS makes a refused write look like a write that matched no
      // rows — so the state afterwards is what is checked.
      await userClient(host.accessToken)
        .from('event_grants')
        .insert({ event_id: event.id, reason: 'early_couple' })

      await userClient(host.accessToken).rpc('grant_event_plan', {
        p_event_slug: event.slug,
        p_reason: 'early_couple',
      })

      await anonClient().rpc('grant_event_plan', {
        p_event_slug: event.slug,
        p_reason: 'early_couple',
      })

      expect(await planSource(event.id)).toBeNull()

      const { count } = await serviceClient()
        .from('event_grants')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event.id)
      expect(count).toBe(0)
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('cannot revoke a grant either', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      await grant(event.slug, 'operator')

      await userClient(host.accessToken).rpc('revoke_event_plan', {
        p_event_slug: event.slug,
      })
      await anonClient().rpc('revoke_event_plan', { p_event_slug: event.slug })

      expect(await planSource(event.id)).toBe('operator')
    } finally {
      await deleteEvent(event.id)
    }
  })
})
