import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  anonClient,
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
 * The host dashboard's one query.
 *
 * `owned_events_with_previews` is SECURITY INVOKER on purpose — the host's own
 * ownership policies are the authorization boundary, and a definer function
 * here would quietly become a way to read every event in the system. The cost
 * of that choice is that everything it calls must also be executable *as the
 * host*, which is not true by default for the security-definer helpers this
 * schema is full of: Postgres checks EXECUTE against the calling role even when
 * the callee is a definer.
 *
 * That is not a theoretical gap. Adding `event_is_full_plan` to the select list
 * took the whole dashboard down with `42501 permission denied for function` —
 * a migration that applied cleanly, and a schema that generated correct types,
 * and a page that failed for every signed-in host. So this file calls the
 * function the way the dashboard does: with a real user's JWT.
 */

let host: TestUser

beforeAll(async () => {
  host = await createUser()
}, 60_000)

afterAll(async () => {
  if (host) await deleteUser(host.id)
})

async function ownedEvents(user: TestUser) {
  const { data, error } = await userClient(user.accessToken).rpc(
    'owned_events_with_previews',
  )
  if (error) throw error
  return data ?? []
}

describe('owned_events_with_previews', () => {
  it('is callable by a signed-in host', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const rows = await ownedEvents(host)
      const mine = rows.find((e) => e.id === event.id)

      expect(mine).toBeDefined()
      // The columns the list actually renders. `time_zone` and `locale` are
      // here because recreating this function from its original definition
      // silently dropped both, and a missing zone means deadlines rendered on
      // the wrong clock.
      expect(mine?.time_zone).toBeTruthy()
      expect(mine?.locale).toBeTruthy()
      expect(mine?.is_full_plan).toBe(false)
      expect(mine?.participant_count).toBe(0)
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('reports is_full_plan from the predicate, not from a count', async () => {
    const paid = await createEvent({ ownerId: host.id })
    const free = await createEvent({ ownerId: host.id })
    try {
      await markPaid(paid.id, host.id)
      // Fill the free event past the cap so the two differ by plan, not by
      // headcount — which is the distinction a participant count cannot make
      // and the reason the column exists.
      for (const name of ['Réka', 'Máté', 'Zsófi', 'Bence', 'Dóra']) {
        await joinEvent(free.slug, name, newSession())
      }

      const rows = await ownedEvents(host)
      expect(rows.find((e) => e.id === paid.id)?.is_full_plan).toBe(true)
      expect(rows.find((e) => e.id === free.id)?.is_full_plan).toBe(false)
      expect(rows.find((e) => e.id === free.id)?.participant_count).toBe(5)
    } finally {
      await deleteEvent(paid.id)
      await deleteEvent(free.id)
    }
  }, 120_000)

  it('is not callable with the anon key', async () => {
    const { data, error } = await anonClient().rpc('owned_events_with_previews')
    // `20260818172146_restrict_admin_event_previews.sql` exists because this
    // was once reachable with the key that ships in the browser bundle.
    expect(error).toBeTruthy()
    expect(data ?? []).toHaveLength(0)
  }, 60_000)

  it('scopes a plain host to their own events', async () => {
    const stranger = await createUser()
    const mine = await createEvent({ ownerId: host.id })
    try {
      const rows = await ownedEvents(stranger)
      expect(rows.find((e) => e.id === mine.id)).toBeUndefined()
    } finally {
      await deleteEvent(mine.id)
      await deleteUser(stranger.id)
    }
  }, 60_000)

  it('shows every event to an admin', async () => {
    const operator = await createUser()
    const mine = await createEvent({ ownerId: host.id })
    try {
      await makeAdmin(operator.id)
      const rows = await ownedEvents(operator)
      // Expected consequence of the admin bypass being OR'd into the host
      // policies, and documented as such in the Supabase skill.
      expect(rows.find((e) => e.id === mine.id)).toBeDefined()
    } finally {
      await deleteEvent(mine.id)
      await deleteUser(operator.id)
    }
  }, 60_000)
})

/**
 * The write half of the same policy, which every host-area settings action
 * leans on and none of them re-checks.
 *
 * `renameEvent`, `setGuestsCanView` and `setShotsPerParticipant` all update
 * `events` by **slug** through the host's own session and then inspect the
 * returned row count. That reads like an IDOR — nothing in the TypeScript
 * compares an owner — and it is safe only because "host manages own events" is
 * `for all`, so a stranger's UPDATE matches zero rows and the count check turns
 * that into a refusal. An automated review flagged exactly this shape, which is
 * the argument for pinning the property instead of asserting it in a comment:
 * if the policy is ever narrowed to `for select`, four actions silently become
 * a real IDOR and this test is what says so.
 *
 * A slug is the right thing to attack with. It is the value those actions take
 * from the URL, and it is not secret — it is printed on the QR code every guest
 * at the party scanned.
 */
describe('the host ownership policy on events', () => {
  it('matches no rows when a stranger updates by slug', async () => {
    const stranger = await createUser()
    const mine = await createEvent({ ownerId: host.id })
    try {
      const { data, error } = await userClient(stranger.accessToken)
        .from('events')
        .update({ event_name: 'Elloptam' })
        .eq('slug', mine.slug)
        .select('id')

      // RLS filters rather than raises, so the refusal arrives as an empty
      // array and no error at all. That is precisely why every action in
      // app/(product)/host/events/[slug]/actions.ts checks the count.
      expect(error).toBeNull()
      expect(data ?? []).toHaveLength(0)

      const { data: after } = await serviceClient()
        .from('events')
        .select('event_name')
        .eq('id', mine.id)
        .single()
      expect(after?.event_name).toBe('Teszt esemény')
    } finally {
      await deleteEvent(mine.id)
      await deleteUser(stranger.id)
    }
  }, 60_000)

  it('lets the owner update by slug', async () => {
    // The other direction, so the test above cannot pass because the update is
    // broken for everyone.
    const mine = await createEvent({ ownerId: host.id })
    try {
      const { data, error } = await userClient(host.accessToken)
        .from('events')
        .update({ event_name: 'Az esküvőnk' })
        .eq('slug', mine.slug)
        .select('id')

      expect(error).toBeNull()
      expect(data ?? []).toHaveLength(1)
    } finally {
      await deleteEvent(mine.id)
    }
  }, 60_000)
})
