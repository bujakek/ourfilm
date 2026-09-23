import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  createEvent,
  createUser,
  deleteEvent,
  deleteUser,
  serviceClient,
  userClient,
  type TestUser,
} from './harness'

let host: TestUser

beforeAll(async () => {
  host = await createUser()
}, 60_000)

afterAll(async () => {
  if (host) await deleteUser(host.id)
})

function pendingRow(eventId: string, extra: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    event_id: eventId,
    owner_id: host.id,
    stripe_checkout_session_id: `cs_test_${randomUUID()}`,
    amount_minor: 1290000,
    currency: 'huf',
    status: 'pending' as const,
    ...extra,
  }
}

describe('billing-country routing in the ledger', () => {
  it('lets a host record the country they confirmed', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const { error } = await userClient(host.accessToken)
        .from('purchases')
        .insert(
          pendingRow(event.id, {
            settlement: 'direct',
            selected_billing_country: 'HU',
          }),
        )
      expect(error).toBeNull()
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('refuses a direct sale recorded for a foreign country', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const { error } = await serviceClient()
        .from('purchases')
        .insert(
          pendingRow(event.id, {
            settlement: 'direct',
            selected_billing_country: 'DE',
          }),
        )
      expect(error?.message).toContain('purchases_direct_is_domestic_check')
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('keeps reconciliation fields out of the host’s reach', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const db = userClient(host.accessToken)
      for (const extra of [
        { reported_billing_country: 'HU' },
        { reconciliation_reason: 'settlement_unverified' },
      ]) {
        const { error } = await db
          .from('purchases')
          .insert(pendingRow(event.id, { settlement: 'managed', ...extra }))
        expect(error).not.toBeNull()
      }
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('never claims a flagged direct sale for invoicing', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const db = serviceClient()
      const id = randomUUID()
      const { error } = await db.from('purchases').insert({
        ...pendingRow(event.id),
        id,
        settlement: 'direct',
        selected_billing_country: 'HU',
        reported_billing_country: 'AT',
        status: 'paid',
        paid_at: new Date().toISOString(),
        invoice_status: 'pending',
        reconciliation_reason: 'billing_country_mismatch',
        reconciliation_flagged_at: new Date().toISOString(),
      })
      if (error) throw error

      const { data: claimed, error: claimError } = await db.rpc(
        'claim_purchase_invoice',
        { p_purchase_id: id },
      )
      if (claimError) throw claimError
      expect(claimed).toBe(false)

      // Cleared by a person after reconciling, it becomes claimable again.
      await db
        .from('purchases')
        .update({ reconciliation_reason: null })
        .eq('id', id)
      const { data: afterReview } = await db.rpc('claim_purchase_invoice', {
        p_purchase_id: id,
      })
      expect(afterReview).toBe(true)
    } finally {
      await deleteEvent(event.id)
    }
  })
})
