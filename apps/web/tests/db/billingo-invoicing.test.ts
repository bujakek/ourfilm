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

let host: TestUser

beforeAll(async () => {
  host = await createUser()
}, 60_000)

afterAll(async () => {
  if (host) await deleteUser(host.id)
})

/** A settled direct purchase, written the way the Stripe webhook writes one. */
async function paidDirectPurchase(eventId: string, ownerId: string) {
  const id = randomUUID()
  const { error } = await serviceClient()
    .from('purchases')
    .insert({
      id,
      event_id: eventId,
      owner_id: ownerId,
      stripe_checkout_session_id: `cs_test_${randomUUID()}`,
      settlement: 'direct',
      amount_minor: 1290000,
      currency: 'huf',
      status: 'paid',
      paid_at: new Date().toISOString(),
      invoice_status: 'pending',
      billing_type: 'individual',
      billing_name: 'Kovács Anna',
      billing_email: 'host@example.com',
      billing_country_code: 'HU',
      billing_post_code: '1039',
      billing_city: 'Budapest',
      billing_address: 'Juhász Gyula utca 2.',
    })
  if (error) throw error
  return id
}

describe('invoice claim', () => {
  it('lets exactly one caller claim a purchase', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const purchaseId = await paidDirectPurchase(event.id, host.id)
      const db = serviceClient()

      // The webhook's own attempt and the sweep, arriving together. Two
      // claims would mean two Billingo documents for one payment, and an
      // issued Hungarian invoice cannot be withdrawn.
      const [first, second] = await Promise.all([
        db.rpc('claim_purchase_invoice', { p_purchase_id: purchaseId }),
        db.rpc('claim_purchase_invoice', { p_purchase_id: purchaseId }),
      ])

      if (first.error) throw first.error
      if (second.error) throw second.error
      expect([first.data, second.data].filter(Boolean)).toHaveLength(1)

      const { data: row } = await db
        .from('purchases')
        .select('invoice_status, invoice_attempts')
        .eq('id', purchaseId)
        .single()
      expect(row?.invoice_status).toBe('processing')
      expect(row?.invoice_attempts).toBe(1)
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('re-claims a lease older than five minutes', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const purchaseId = await paidDirectPurchase(event.id, host.id)
      const db = serviceClient()

      const { data: claimed } = await db.rpc('claim_purchase_invoice', {
        p_purchase_id: purchaseId,
      })
      expect(claimed).toBe(true)

      // A Vercel invocation that died mid-invoice holds the row in
      // 'processing' for ever otherwise.
      const { data: again } = await db.rpc('claim_purchase_invoice', {
        p_purchase_id: purchaseId,
      })
      expect(again).toBe(false)

      await db
        .from('purchases')
        .update({
          invoicing_started_at: new Date(
            Date.now() - 10 * 60_000,
          ).toISOString(),
        })
        .eq('id', purchaseId)

      const { data: recovered } = await db.rpc('claim_purchase_invoice', {
        p_purchase_id: purchaseId,
      })
      expect(recovered).toBe(true)
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('never claims a Managed Payments purchase', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const id = randomUUID()
      const db = serviceClient()
      const { error } = await db.from('purchases').insert({
        id,
        event_id: event.id,
        owner_id: host.id,
        stripe_checkout_session_id: `cs_test_${randomUUID()}`,
        settlement: 'managed',
        amount_minor: 3900,
        currency: 'usd',
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      if (error) throw error

      // Link is the merchant of record there and issues the document.
      const { data: claimed } = await db.rpc('claim_purchase_invoice', {
        p_purchase_id: id,
      })
      expect(claimed).toBe(false)
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('refuses the claim RPCs to a host and to anon', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const purchaseId = await paidDirectPurchase(event.id, host.id)

      // Supabase grants execute to anon and authenticated directly, so the
      // migration has to revoke from them by name. A host who could claim
      // their own invoice could drive it into any state they liked.
      for (const db of [userClient(host.accessToken), anonClient()]) {
        const { error } = await db.rpc('claim_purchase_invoice', {
          p_purchase_id: purchaseId,
        })
        expect(error).not.toBeNull()
      }
    } finally {
      await deleteEvent(event.id)
    }
  })
})

describe('invoice columns are the webhook’s alone', () => {
  it('refuses a host who writes billing data into their pending row', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const db = userClient(host.accessToken)

      // The insert policy is what stops a host declaring their own invoice
      // snapshot. Stripe supplies it after payment; only the service role
      // writes it.
      const { error } = await db.from('purchases').insert({
        id: randomUUID(),
        event_id: event.id,
        owner_id: host.id,
        stripe_checkout_session_id: `cs_test_${randomUUID()}`,
        settlement: 'direct',
        amount_minor: 1290000,
        currency: 'huf',
        status: 'pending',
        billing_name: 'Nem Én Vagyok',
      })
      expect(error).not.toBeNull()
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('lets a host write only the pending ledger row', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const db = userClient(host.accessToken)
      const { error } = await db.from('purchases').insert({
        id: randomUUID(),
        event_id: event.id,
        owner_id: host.id,
        stripe_checkout_session_id: `cs_test_${randomUUID()}`,
        settlement: 'direct',
        amount_minor: 1290000,
        currency: 'huf',
        status: 'pending',
      })
      expect(error).toBeNull()
    } finally {
      await deleteEvent(event.id)
    }
  })

  it('refuses a host updating an issued invoice', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const purchaseId = await paidDirectPurchase(event.id, host.id)
      // Unique per run: `purchases_billingo_document_idx` is a real unique
      // index, so a fixed id turns one leaked row into a permanently red
      // suite. Which is how this comment came to be written.
      const documentId = Date.now() % 1_000_000_000
      const { error: setupError } = await serviceClient()
        .from('purchases')
        .update({ invoice_status: 'issued', billingo_document_id: documentId })
        .eq('id', purchaseId)
      if (setupError) throw setupError

      // `purchases` has no update policy at all, so this writes zero rows and
      // returns 204 rather than an error — assert on the row, not the status.
      await userClient(host.accessToken)
        .from('purchases')
        .update({ invoice_status: 'not_started', billingo_document_id: null })
        .eq('id', purchaseId)

      const { data: row } = await serviceClient()
        .from('purchases')
        .select('invoice_status, billingo_document_id')
        .eq('id', purchaseId)
        .single()
      expect(row?.invoice_status).toBe('issued')
      expect(row?.billingo_document_id).toBe(documentId)
    } finally {
      await deleteEvent(event.id)
    }
  })
})

describe('the accounting record outlives the album', () => {
  it('keeps a paid purchase when the event is deleted', async () => {
    const event = await createEvent({ ownerId: host.id })
    const purchaseId = await paidDirectPurchase(event.id, host.id)

    try {
      // Deliberately not `deleteEvent`, which clears the event's purchases
      // first so the suite does not leak them. What is under test is what the
      // *database* does to a purchase when its event goes.
      const { error } = await serviceClient()
        .from('events')
        .delete()
        .eq('id', event.id)
      if (error) throw error

      // `on delete set null`, not a cascade: the money moved and the invoice
      // is still owed. The billing snapshot on the row is self-contained.
      const { data: row } = await serviceClient()
        .from('purchases')
        .select('event_id, status, invoice_status, billing_name')
        .eq('id', purchaseId)
        .single()
      expect(row?.event_id).toBeNull()
      expect(row?.status).toBe('paid')
      expect(row?.billing_name).toBe('Kovács Anna')
    } finally {
      await serviceClient().from('purchases').delete().eq('id', purchaseId)
    }
  })
})

describe('the invoice sweep schedule', () => {
  it('is installed by the migration', async () => {
    const { data, error } = await serviceClient().rpc('invoice_cron_jobs')
    if (error) throw error

    // Versioned in a migration so it comes back on every `db reset`. Without
    // it the Stripe webhook is the only attempt any invoice ever gets.
    expect(data).toContainEqual(
      expect.objectContaining({
        jobname: 'invoices-sweep-http',
        schedule: '*/5 * * * *',
        active: true,
      }),
    )
  })
})
