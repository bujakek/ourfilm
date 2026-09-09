import type Stripe from 'stripe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  constructEventAsync: vi.fn(),
  createAdminClient: vi.fn(),
  reportServerIssue: vi.fn(async () => undefined),
  reportServerEvent: vi.fn(async () => undefined),
  ensureBillingoInvoice: vi.fn(
    async (): Promise<'issued' | 'skipped' | 'failed'> => 'issued',
  ),
  cancelBillingoInvoice: vi.fn(
    async (): Promise<'cancelled' | 'skipped' | 'failed'> => 'cancelled',
  ),
}))

vi.mock('@/lib/billingo/invoicing', () => ({
  ensureBillingoInvoice: mocks.ensureBillingoInvoice,
  cancelBillingoInvoice: mocks.cancelBillingoInvoice,
}))

vi.mock('@/lib/telemetry-server', () => ({
  reportServerIssue: mocks.reportServerIssue,
  reportServerEvent: mocks.reportServerEvent,
}))

vi.mock('@/lib/stripe/client', () => ({
  getStripe: () => ({
    webhooks: { constructEventAsync: mocks.constructEventAsync },
  }),
}))

vi.mock('@/lib/stripe/env', () => ({
  stripeEnv: () => ({ webhookSecret: 'whsec_unit_test' }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}))

import { POST } from '@/app/api/stripe/webhook/route'

type Write = {
  table: string
  values: Record<string, unknown>
  filters: Record<string, unknown>
  column?: string
  value?: unknown
}

type PurchaseRow = Record<string, unknown> & { id: string }

/** The pending ledger row a direct Hungarian checkout always leaves behind. */
function directPurchase(overrides: Record<string, unknown> = {}): PurchaseRow {
  return {
    id: '52f89c12-f4a7-463b-98d7-7fe57450a89c',
    event_id: 'event-id',
    owner_id: 'owner-id',
    stripe_checkout_session_id: 'cs_test_ourfilm',
    settlement: 'direct',
    status: 'pending',
    invoice_status: 'not_started',
    amount_minor: 1_290_000,
    currency: 'huf',
    paid_at: null,
    terms_accepted_at: null,
    early_performance_consent_at: null,
    ...overrides,
  }
}

/**
 * A chainable stand-in for the PostgREST client.
 *
 * Filters are collected as the call chain is built and the write is recorded
 * when it resolves, which is the only point at which the whole statement is
 * known — `update().eq().eq()` is a different statement from `update().eq()`.
 */
function database({
  duplicate = false,
  eventDeleted = false,
  purchase = null,
}: {
  duplicate?: boolean
  eventDeleted?: boolean
  purchase?: PurchaseRow | null
} = {}) {
  const upserts: Write[] = []
  const updates: Write[] = []

  const rowsFor = (table: string) => {
    if (table === 'events') {
      return eventDeleted ? [] : [{ owner_id: 'owner-id' }]
    }
    if (table === 'stripe_webhook_events') {
      return duplicate ? [{ processed_at: '2026-09-01T12:00:00.000Z' }] : []
    }
    if (table === 'purchases') return purchase ? [purchase] : []
    return []
  }

  function query(
    table: string,
    kind: 'select' | 'update',
    values: Record<string, unknown>,
  ) {
    const filters: Record<string, unknown> = {}
    let recorded = false

    const settle = () => {
      if (kind === 'update' && !recorded) {
        recorded = true
        const [column, value] = Object.entries(filters)[0] ?? []
        updates.push({ table, values, filters, column, value })
      }
      return rowsFor(table)
    }

    const builder = {
      eq(column: string, value: unknown) {
        filters[column] = value
        return builder
      },
      in(column: string, value: unknown) {
        filters[column] = value
        return builder
      },
      lte(column: string, value: unknown) {
        filters[column] = value
        return builder
      },
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => ({ data: settle()[0] ?? null, error: null }),
      single: async () => ({ data: settle()[0] ?? null, error: null }),
      select: async () => ({ data: settle(), error: null }),
      then: (resolve: (result: { data: unknown[]; error: null }) => unknown) =>
        resolve({ data: settle(), error: null }),
    }
    return builder
  }

  const db = {
    from(table: string) {
      return {
        insert() {
          return {
            select() {
              return {
                maybeSingle: async () =>
                  duplicate
                    ? { data: null, error: { code: '23505' } }
                    : { data: { id: 'evt_test' }, error: null },
              }
            },
          }
        },
        select: () => query(table, 'select', {}),
        upsert(values: Record<string, unknown>) {
          upserts.push({ table, values, filters: {} })
          return Promise.resolve({ error: null })
        },
        update: (values: Record<string, unknown>) =>
          query(table, 'update', values),
      }
    },
  }

  return { db, upserts, updates }
}

function event(
  type: Stripe.Event.Type,
  object: Record<string, unknown>,
): Stripe.Event {
  return {
    id: `evt_${type.replaceAll('.', '_')}`,
    object: 'event',
    api_version: '2026-07-29.dahlia',
    created: 1_788_264_000,
    data: { object },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type,
  } as unknown as Stripe.Event
}

function session(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'cs_test_ourfilm',
    object: 'checkout.session',
    mode: 'payment',
    payment_status: 'paid',
    amount_total: 1_290_000,
    currency: 'huf',
    client_reference_id: 'event-id',
    metadata: { event_id: 'event-id', owner_id: 'owner-id' },
    payment_intent: 'pi_test_ourfilm',
    customer: 'cus_test_ourfilm',
    ...overrides,
  }
}

/** What Stripe returns for a direct Hungarian sale, invoice data and all. */
function directSession(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return session({
    metadata: {
      event_id: 'event-id',
      owner_id: 'owner-id',
      settlement: 'direct',
      purchase_id: directPurchase().id,
      legal_version: '2026-08-31-mor-hu',
      terms_accepted_at: '2026-09-01T12:00:00.000Z',
      early_performance_requested: 'true',
    },
    consent: { terms_of_service: 'accepted' },
    customer_details: {
      email: 'host@example.com',
      name: 'Kovács Anna',
      individual_name: 'Kovács Anna',
      business_name: null,
      tax_ids: [],
      address: {
        country: 'HU',
        postal_code: '1039',
        city: 'Budapest',
        line1: 'Juhász Gyula utca 2.',
        line2: null,
      },
    },
    ...overrides,
  })
}

function request() {
  return new Request('https://ourfilm.app/api/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 't=1,v1=unit-test' },
    body: '{}',
  })
}

describe('Stripe webhook', () => {
  beforeEach(() => {
    mocks.constructEventAsync.mockReset()
    mocks.createAdminClient.mockReset()
    mocks.reportServerIssue.mockClear()
    mocks.reportServerEvent.mockClear()
    mocks.ensureBillingoInvoice.mockClear()
    mocks.cancelBillingoInvoice.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects an invalid signature before opening the database', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.constructEventAsync.mockRejectedValue(new Error('bad signature'))

    const response = await POST(request())

    expect(response.status).toBe(400)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it.each([
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
  ] as const)('records a settled %s event as paid', async (type) => {
    const { db, upserts } = database()
    mocks.createAdminClient.mockReturnValue(db)
    mocks.constructEventAsync.mockResolvedValue(event(type, session()))

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(upserts).toHaveLength(1)
    expect(upserts[0]).toMatchObject({
      table: 'purchases',
      values: {
        event_id: 'event-id',
        owner_id: 'owner-id',
        stripe_checkout_session_id: 'cs_test_ourfilm',
        stripe_payment_intent_id: 'pi_test_ourfilm',
        amount_minor: 1_290_000,
        currency: 'huf',
        status: 'paid',
        failed_at: null,
        expired_at: null,
      },
    })
  })

  it('reports a sale only when the ledger took the row', async () => {
    const { db } = database()
    mocks.createAdminClient.mockReturnValue(db)
    mocks.constructEventAsync.mockResolvedValue(
      event('checkout.session.completed', session()),
    )

    await POST(request())

    // The only trustworthy end of the payment funnel — `?checkout=success` is
    // a URL a host can type — and it carries the event id rather than
    // anything of Stripe's, so it joins to `checkout_started` and to nothing
    // that identifies a person.
    expect(mocks.reportServerEvent).toHaveBeenCalledWith('checkout_settled', {
      event_id: 'event-id',
      status: 'paid',
      amount_minor: 1_290_000,
      currency: 'huf',
      event_deleted: false,
    })
  })

  it('reports no sale for a completed but unpaid Session', async () => {
    const { db } = database()
    mocks.createAdminClient.mockReturnValue(db)
    mocks.constructEventAsync.mockResolvedValue(
      event(
        'checkout.session.completed',
        session({ payment_status: 'unpaid' }),
      ),
    )

    await POST(request())

    // A delayed payment method completes checkout and settles later. Counting
    // it here would report revenue the ledger deliberately does not have.
    expect(mocks.reportServerEvent).not.toHaveBeenCalled()
  })

  it('does not fulfil a completed but unpaid Session', async () => {
    const { db, upserts } = database()
    mocks.createAdminClient.mockReturnValue(db)
    mocks.constructEventAsync.mockResolvedValue(
      event(
        'checkout.session.completed',
        session({ payment_status: 'unpaid' }),
      ),
    )

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(upserts).toHaveLength(0)
  })

  it.each([
    ['checkout.session.async_payment_failed', 'failed', 'failed_at'],
    ['checkout.session.expired', 'expired', 'expired_at'],
  ] as const)('records %s as %s', async (type, status, timestampField) => {
    const { db, upserts } = database()
    mocks.createAdminClient.mockReturnValue(db)
    mocks.constructEventAsync.mockResolvedValue(event(type, session()))

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(upserts).toHaveLength(1)
    expect(upserts[0].values).toMatchObject({
      stripe_checkout_session_id: 'cs_test_ourfilm',
      status,
    })
    expect(upserts[0].values[timestampField]).toEqual(expect.any(String))
  })

  it('takes the owner from the event row, not the session metadata', async () => {
    const { db, upserts } = database()
    mocks.createAdminClient.mockReturnValue(db)
    mocks.constructEventAsync.mockResolvedValue(
      event(
        'checkout.session.completed',
        session({ metadata: { event_id: 'event-id', owner_id: 'someone' } }),
      ),
    )

    expect((await POST(request())).status).toBe(200)
    expect(upserts[0].values).toMatchObject({ owner_id: 'owner-id' })
  })

  it.each([
    ['checkout.session.async_payment_failed', 'failed'],
    ['checkout.session.expired', 'expired'],
  ] as const)(
    'acknowledges a %s session whose event was deleted',
    async (type, status) => {
      // The host deleted the event after starting to pay; the pending row went
      // with it. No money moved, so there is nothing to insert, and a 500 here
      // only has Stripe retry a foreign-key violation for three days.
      vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      const { db, upserts, updates } = database({ eventDeleted: true })
      mocks.createAdminClient.mockReturnValue(db)
      mocks.constructEventAsync.mockResolvedValue(
        event(type, session({ payment_status: 'unpaid' })),
      )

      const response = await POST(request())

      expect(response.status).toBe(200)
      expect(upserts).toHaveLength(0)
      expect(mocks.reportServerIssue).not.toHaveBeenCalled()
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(status))
      // Marked processed, so a redelivery is a no-op rather than a rerun.
      expect(updates).toContainEqual(
        expect.objectContaining({
          table: 'stripe_webhook_events',
          values: { processed_at: expect.any(String) },
        }),
      )
    },
  )

  it('keeps failing loudly for a paid session whose event was deleted', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { db, upserts, updates } = database({ eventDeleted: true })
    mocks.createAdminClient.mockReturnValue(db)
    mocks.constructEventAsync.mockResolvedValue(
      event('checkout.session.completed', session()),
    )

    const response = await POST(request())

    expect(response.status).toBe(500)
    expect(upserts).toHaveLength(0)
    expect(updates).toEqual([])
    expect(mocks.reportServerIssue).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'OrphanedPaymentError' }),
      expect.objectContaining({ operation: 'stripe_webhook_handle' }),
    )
  })

  it('skips an event that was already processed', async () => {
    const { db, upserts } = database({ duplicate: true })
    mocks.createAdminClient.mockReturnValue(db)
    mocks.constructEventAsync.mockResolvedValue(
      event('checkout.session.completed', session()),
    )

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ duplicate: true })
    expect(upserts).toHaveLength(0)
  })

  it('revokes access only after a full refund', async () => {
    const full = database({
      purchase: directPurchase({ settlement: 'managed', status: 'paid' }),
    })
    mocks.createAdminClient.mockReturnValue(full.db)
    mocks.constructEventAsync.mockResolvedValue(
      event('charge.refunded', {
        id: 'ch_full',
        object: 'charge',
        amount: 1_290_000,
        amount_refunded: 1_290_000,
        payment_intent: 'pi_test_ourfilm',
      }),
    )

    expect((await POST(request())).status).toBe(200)
    expect(full.updates).toContainEqual(
      expect.objectContaining({
        table: 'purchases',
        values: expect.objectContaining({ status: 'refunded' }),
        // By id now, not by payment intent: the row is read first so the
        // handler can tell a direct sale — which owes a storno document —
        // from a Managed Payments one, which does not.
        column: 'id',
        value: directPurchase().id,
      }),
    )
    expect(mocks.cancelBillingoInvoice).not.toHaveBeenCalled()

    const partial = database({
      purchase: directPurchase({ settlement: 'managed', status: 'paid' }),
    })
    mocks.createAdminClient.mockReturnValue(partial.db)
    mocks.constructEventAsync.mockResolvedValue(
      event('charge.refunded', {
        id: 'ch_partial',
        object: 'charge',
        amount: 1_290_000,
        amount_refunded: 100_000,
        payment_intent: 'pi_test_ourfilm',
      }),
    )

    expect((await POST(request())).status).toBe(200)
    expect(
      partial.updates.filter((write) => write.table === 'purchases'),
    ).toEqual([])
  })

  // The split, from the webhook's side. Link issues the document for a
  // Managed Payments sale, so raising a Billingo invoice for one would put a
  // second document in front of a customer who already has one.
  it('invoices a direct sale and writes the billing snapshot', async () => {
    const { db, updates } = database({ purchase: directPurchase() })
    mocks.createAdminClient.mockReturnValue(db)
    mocks.constructEventAsync.mockResolvedValue(
      event('checkout.session.completed', directSession()),
    )

    expect((await POST(request())).status).toBe(200)

    const write = updates.find((w) => w.table === 'purchases')
    expect(write?.values).toMatchObject({
      status: 'paid',
      billing_name: 'Kovács Anna',
      billing_country_code: 'HU',
      billing_post_code: '1039',
      billing_city: 'Budapest',
      billing_address: 'Juhász Gyula utca 2.',
      billing_type: 'individual',
      invoice_status: 'pending',
      terms_version: '2026-08-31-mor-hu',
    })
    // Never `event_id` or `owner_id`: both are `on delete set null`, and
    // rewriting them would fail the foreign key for a deleted album.
    expect(write?.values).not.toHaveProperty('event_id')
    expect(write?.values).not.toHaveProperty('owner_id')
    expect(mocks.ensureBillingoInvoice).toHaveBeenCalledWith(
      db,
      directPurchase().id,
      'webhook',
    )
  })

  it('raises no invoice for a Managed Payments sale', async () => {
    const { db } = database({
      purchase: directPurchase({ settlement: 'managed' }),
    })
    mocks.createAdminClient.mockReturnValue(db)
    mocks.constructEventAsync.mockResolvedValue(
      event('checkout.session.completed', session()),
    )

    expect((await POST(request())).status).toBe(200)
    expect(mocks.ensureBillingoInvoice).not.toHaveBeenCalled()
  })

  it('still answers 200 when Billingo cannot issue the invoice', async () => {
    mocks.ensureBillingoInvoice.mockResolvedValueOnce('failed')
    const { db } = database({ purchase: directPurchase() })
    mocks.createAdminClient.mockReturnValue(db)
    mocks.constructEventAsync.mockResolvedValue(
      event('checkout.session.completed', directSession()),
    )

    // The money moved and the album is unlocked. 500ing over a Billingo
    // outage would leave `processed_at` null and have Stripe re-run the
    // *payment* handler for three days; the sweep owns this retry.
    expect((await POST(request())).status).toBe(200)
  })

  it('still invoices a sale that arrives without accepted terms', async () => {
    const { db, updates } = database({ purchase: directPurchase() })
    mocks.createAdminClient.mockReturnValue(db)
    mocks.constructEventAsync.mockResolvedValue(
      event('checkout.session.completed', directSession({ consent: null })),
    )

    expect((await POST(request())).status).toBe(200)
    const write = updates.find((w) => w.table === 'purchases')
    // The invoice is owed under Hungarian law whatever the checkbox did, so
    // the missing consent is recorded rather than used to withhold it.
    expect(write?.values).toMatchObject({
      status: 'paid',
      invoice_status: 'pending',
      early_performance_consent_at: null,
    })
    expect(mocks.ensureBillingoInvoice).toHaveBeenCalled()
  })

  it('parks a direct sale whose billing address is not Hungarian', async () => {
    const { db, updates } = database({ purchase: directPurchase() })
    mocks.createAdminClient.mockReturnValue(db)
    mocks.constructEventAsync.mockResolvedValue(
      event(
        'checkout.session.completed',
        directSession({
          customer_details: {
            email: 'host@example.com',
            name: 'Anna Kovacs',
            individual_name: 'Anna Kovacs',
            business_name: null,
            tax_ids: [],
            address: {
              country: 'AT',
              postal_code: '1010',
              city: 'Wien',
              line1: 'Stephansplatz 1',
              line2: null,
            },
          },
        }),
      ),
    )

    expect((await POST(request())).status).toBe(200)
    // Still paid — the money is real — but there is no lawful Hungarian
    // invoice to build from a foreign address, and that needs a human.
    expect(updates.find((w) => w.table === 'purchases')?.values).toMatchObject({
      status: 'paid',
      invoice_status: 'failed',
    })
    expect(mocks.ensureBillingoInvoice).not.toHaveBeenCalled()
  })

  it('takes the amount from Stripe, not from the host-written ledger row', async () => {
    const { db, updates } = database({
      purchase: directPurchase({ amount_minor: 100 }),
    })
    mocks.createAdminClient.mockReturnValue(db)
    mocks.constructEventAsync.mockResolvedValue(
      event('checkout.session.completed', directSession()),
    )

    expect((await POST(request())).status).toBe(200)
    // The row's amount was written by the host's own client. Stripe is the
    // authority on what was actually charged, and that is the number that
    // ends up on a document carrying our tax number.
    expect(updates.find((w) => w.table === 'purchases')?.values).toMatchObject({
      amount_minor: 1_290_000,
      currency: 'huf',
      invoice_status: 'pending',
    })
    expect(mocks.reportServerIssue).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('differs') }),
      expect.objectContaining({ operation: 'checkout_amount_mismatch' }),
    )
    expect(mocks.ensureBillingoInvoice).toHaveBeenCalled()
  })

  it('cancels the invoice when a direct sale is refunded', async () => {
    const { db, updates } = database({
      purchase: directPurchase({ status: 'paid', invoice_status: 'issued' }),
    })
    mocks.createAdminClient.mockReturnValue(db)
    mocks.constructEventAsync.mockResolvedValue(
      event('charge.refunded', {
        id: 'ch_full',
        object: 'charge',
        amount: 1_290_000,
        amount_refunded: 1_290_000,
        payment_intent: 'pi_test_ourfilm',
      }),
    )

    expect((await POST(request())).status).toBe(200)
    // An issued Hungarian invoice is never deleted, only cancelled with a
    // storno document.
    expect(updates.find((w) => w.table === 'purchases')?.values).toMatchObject({
      status: 'refunded',
      invoice_status: 'cancellation_pending',
    })
    expect(mocks.cancelBillingoInvoice).toHaveBeenCalledWith(
      db,
      directPurchase().id,
      'webhook',
    )
  })

  it('settles a paid direct sale whose album was deleted', async () => {
    const { db, updates } = database({
      // `on delete set null` leaves the accounting record behind. The invoice
      // is still owed: the money moved before the album was deleted.
      purchase: directPurchase({ event_id: null, owner_id: null }),
      eventDeleted: true,
    })
    mocks.createAdminClient.mockReturnValue(db)
    mocks.constructEventAsync.mockResolvedValue(
      event('checkout.session.completed', directSession()),
    )

    expect((await POST(request())).status).toBe(200)
    expect(updates.find((w) => w.table === 'purchases')?.values).toMatchObject({
      status: 'paid',
      invoice_status: 'pending',
    })
    expect(mocks.reportServerEvent).toHaveBeenCalledWith(
      'checkout_settled',
      expect.objectContaining({ event_id: null, event_deleted: true }),
    )
    expect(mocks.ensureBillingoInvoice).toHaveBeenCalled()
  })
})
