import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
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
  it('updates only the signed-in profile and propagates to existing credits', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const participant = await hostParticipant(event.id, host.id, 'old-name')

      const { data, error } = await userClient(host.accessToken)
        .from('profiles')
        .update({ display_name: 'László Buják' })
        .eq('id', host.id)
        .select('display_name')

      expect(error).toBeNull()
      expect(data?.[0]?.display_name).toBe('László Buják')

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

  it('cannot update another account or promote itself', async () => {
    const hostClient = userClient(host.accessToken)

    await hostClient
      .from('profiles')
      .update({ display_name: 'Not yours' })
      .eq('id', stranger.id)

    const { data: strangerProfile } = await serviceClient()
      .from('profiles')
      .select('display_name')
      .eq('id', stranger.id)
      .single()
    expect(strangerProfile?.display_name).toBeNull()

    const { error: roleError } = await hostClient
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', host.id)
    expect(roleError).toBeTruthy()

    const { data: hostProfile } = await serviceClient()
      .from('profiles')
      .select('role')
      .eq('id', host.id)
      .single()
    expect(hostProfile?.role).toBe('user')
  })

  it('rejects blank, one-character, and oversized names', async () => {
    const client = userClient(host.accessToken)

    for (const display_name of ['', 'A', 'x'.repeat(41), ' Trimmed ']) {
      const { error } = await client
        .from('profiles')
        .update({ display_name })
        .eq('id', host.id)
      expect(error).toBeTruthy()
    }
  })
})
