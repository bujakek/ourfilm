import type Stripe from 'stripe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  constructEventAsync: vi.fn(),
  createAdminClient: vi.fn(),
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
  column?: string
  value?: unknown
}

function database({ duplicate = false }: { duplicate?: boolean } = {}) {
  const upserts: Write[] = []
  const updates: Write[] = []

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
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({
                  data: duplicate
                    ? { processed_at: '2026-09-01T12:00:00.000Z' }
                    : null,
                  error: null,
                }),
              }
            },
          }
        },
        upsert(values: Record<string, unknown>) {
          upserts.push({ table, values })
          return Promise.resolve({ error: null })
        },
        update(values: Record<string, unknown>) {
          return {
            eq(column: string, value: unknown) {
              updates.push({ table, values, column, value })
              return Promise.resolve({ error: null })
            },
          }
        },
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
    const full = database()
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
        column: 'stripe_payment_intent_id',
        value: 'pi_test_ourfilm',
      }),
    )

    const partial = database()
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
})
