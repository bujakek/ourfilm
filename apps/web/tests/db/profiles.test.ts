import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  anonClient,
  createEvent,
  createUser,
  deleteEvent,
  deleteUser,
  hostParticipant,
  serviceClient,
  type TestUser,
  userClient,
} from './harness'

let host: TestUser
let stranger: TestUser

beforeAll(async () => {
  ;[host, stranger] = await Promise.all([createUser(), createUser()])
}, 60_000)

afterAll(async () => {
  if (host) await deleteUser(host.id)
  if (stranger) await deleteUser(stranger.id)
})

describe('host display names', () => {
  it('saves through the RPC and propagates to existing credits', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const participant = await hostParticipant(event.id, host.id, 'old-name')

      const { data, error } = await userClient(host.accessToken).rpc(
        'set_host_display_name',
        { p_name: 'László Buják' },
      )

      expect(error).toBeNull()
      expect(data).toBe('László Buják')

      const { data: credited, error: creditError } = await serviceClient()
        .from('participants')
        .select('display_name')
        .eq('id', participant!.participant_id)
        .single()
      if (creditError) throw creditError
      expect(credited.display_name).toBe('László Buják')
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('trims, and refuses blank, one-character and oversized names', async () => {
    const client = userClient(host.accessToken)

    for (const name of ['', ' ', 'A', 'x'.repeat(41)]) {
      const { error } = await client.rpc('set_host_display_name', {
        p_name: name,
      })
      expect(error).toBeTruthy()
    }

    const { data } = await client.rpc('set_host_display_name', {
      p_name: '  Réka N.  ',
    })
    expect(data).toBe('Réka N.')
  })

  /**
   * The reason the RPC exists. `profiles` has no self-update policy, so a
   * direct PATCH matches no row whatever it sets — and `role` in particular
   * stays exactly as unwritable as it was before display names existed.
   *
   * Asserted as a no-op rather than as an error, and the difference matters.
   * `authenticated` still holds the ordinary table grant, so PostgREST is
   * happy to run the statement; RLS simply filters it to zero rows and returns
   * success. A test expecting an error here would pass for the wrong reason
   * under a grant-based design and fail under this one, while a row that
   * actually changed would slip past either way. So this checks the row.
   */
  it('leaves the profiles table itself unwritable by its owner', async () => {
    const client = userClient(host.accessToken)

    const { data: nameRow } = await client
      .from('profiles')
      .update({ display_name: 'Straight through the table' })
      .eq('id', host.id)
      .select('id')
      .maybeSingle()
    expect(nameRow).toBeNull()

    const { data: roleRow } = await client
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', host.id)
      .select('id')
      .maybeSingle()
    expect(roleRow).toBeNull()

    const { data: profile } = await serviceClient()
      .from('profiles')
      .select('role, display_name')
      .eq('id', host.id)
      .single()
    expect(profile?.role).toBe('user')
    expect(profile?.display_name).toBe('Réka N.')
  })

  /** The RPC takes no user id, so another account is not addressable at all. */
  it('cannot reach another account', async () => {
    await userClient(host.accessToken).rpc('set_host_display_name', {
      p_name: 'Not yours',
    })

    const { data: strangerProfile } = await serviceClient()
      .from('profiles')
      .select('display_name')
      .eq('id', stranger.id)
      .single()
    expect(strangerProfile?.display_name).toBeNull()
  })

  it('is not callable with the anon key', async () => {
    const { error } = await anonClient().rpc('set_host_display_name', {
      p_name: 'Anonymous',
    })
    expect(error).toBeTruthy()
  })
})
