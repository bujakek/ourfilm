import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  anonClient,
  createUser,
  deleteUser,
  serviceClient,
  userClient,
  type TestUser,
} from './harness'

const email = `early-couple-${randomUUID().slice(0, 8)}@example.invalid`
let host: TestUser

beforeAll(async () => {
  host = await createUser()
  const { error } = await serviceClient()
    .from('early_couple_applications')
    .insert({
      name: 'Anna',
      email,
      wedding_date: '2027-06-12',
      wedding_location: 'Budapest',
      guest_count_range: '101-150',
      why_interested: 'A private test application for the RLS suite.',
      locale: 'en',
    })
  if (error) throw error
}, 60_000)

afterAll(async () => {
  await serviceClient()
    .from('early_couple_applications')
    .delete()
    .eq('email', email)
  if (host) await deleteUser(host.id)
})

describe('Early Couple application privacy', () => {
  it('cannot be read with the public browser key', async () => {
    const { data } = await anonClient()
      .from('early_couple_applications')
      .select('email')
      .eq('email', email)

    expect(data ?? []).toHaveLength(0)
  })

  it('cannot be read by an ordinary signed-in host', async () => {
    const { data } = await userClient(host.accessToken)
      .from('early_couple_applications')
      .select('email')
      .eq('email', email)

    expect(data ?? []).toHaveLength(0)
  })

  it('does not expose the rate-limit RPC to the public key', async () => {
    const { error } = await anonClient().rpc(
      'consume_early_couple_rate_limit',
      { p_key_hash: 'a'.repeat(64) },
    )

    expect(error).toBeTruthy()
  })
})
