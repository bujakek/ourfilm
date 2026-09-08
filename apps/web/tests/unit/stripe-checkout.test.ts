import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  createSupabaseClient: vi.fn(),
}))

vi.mock('@/lib/request-origin', () => ({
  requestOrigin: () => Promise.resolve('http://localhost:3000'),
}))

vi.mock('@/lib/stripe/client', () => ({
  getStripe: () => ({
    checkout: { sessions: { create: mocks.createSession } },
  }),
}))

vi.mock('@/lib/stripe/env', () => ({
  stripeEnv: () => ({
    eventPriceId: 'price_test_ourfilm_huf',
    eventPriceUsdId: 'price_test_ourfilm_usd',
  }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createSupabaseClient,
}))

import { createEventCheckoutUrl } from '@/lib/stripe/checkout'

function database({
  reservationError = null,
}: { reservationError?: unknown } = {}) {
  const reservation = {
    attempt_id: '52f89c12-f4a7-463b-98d7-7fe57450a89c',
    expires_at: new Date(Date.now() + 45 * 60 * 1_000).toISOString(),
    terms_accepted_at: '2026-09-01T12:00:00.000Z',
  }
  const inserts: Record<string, unknown>[] = []

  return {
    reservation,
    inserts,
    client: {
      rpc() {
        return {
          single: async () => ({
            data: reservationError ? null : reservation,
            error: reservationError,
          }),
        }
      },
      from() {
        return {
          insert(values: Record<string, unknown>) {
            inserts.push(values)
            return Promise.resolve({ error: null })
          },
        }
      },
    },
  }
}

const checkout = {
  eventId: '113020ae-2ad3-4296-977e-42f173b662a3',
  slug: 'anna-es-mark-eskuvoje-a1b2c3',
  ownerId: '6054ca65-6b32-42b0-a317-505108968879',
  ownerEmail: 'host@example.com',
  locale: 'en' as const,
  termsAcceptedAt: '2026-09-01T12:01:00.000Z',
}

describe('Stripe Checkout creation', () => {
  beforeEach(() => {
    mocks.createSession.mockReset()
    mocks.createSupabaseClient.mockReset()
  })

  it('uses the reserved attempt as the Stripe idempotency boundary', async () => {
    const db = database()
    mocks.createSupabaseClient.mockResolvedValue(db.client)
    mocks.createSession.mockResolvedValue({
      id: 'cs_test_ourfilm',
      url: 'https://checkout.stripe.com/c/pay/cs_test_ourfilm',
    })

    const first = await createEventCheckoutUrl(checkout)
    const second = await createEventCheckoutUrl({
      ...checkout,
      termsAcceptedAt: '2026-09-01T12:01:01.000Z',
    })

    expect(first).toBe(second)
    expect(mocks.createSession).toHaveBeenCalledTimes(2)

    const [firstParams, firstOptions] = mocks.createSession.mock.calls[0]
    const [secondParams, secondOptions] = mocks.createSession.mock.calls[1]
    expect(firstOptions).toEqual(secondOptions)
    expect(firstOptions.idempotencyKey).toContain(db.reservation.attempt_id)
    expect(firstParams).toEqual(secondParams)
    expect(firstParams.metadata.terms_accepted_at).toBe(
      db.reservation.terms_accepted_at,
    )
    expect(firstParams.line_items).toEqual([
      { price: 'price_test_ourfilm_usd', quantity: 1 },
    ])
    expect(firstParams.locale).toBe('en')
    expect(db.inserts).toHaveLength(2)
    expect(db.inserts[0]).toMatchObject({
      stripe_checkout_session_id: 'cs_test_ourfilm',
      status: 'pending',
    })
  })

  it('does not call Stripe when the database refuses the reservation', async () => {
    const db = database({ reservationError: new Error('already paid') })
    mocks.createSupabaseClient.mockResolvedValue(db.client)

    await expect(createEventCheckoutUrl(checkout)).rejects.toThrow(
      'already paid',
    )
    expect(mocks.createSession).not.toHaveBeenCalled()
    expect(db.inserts).toHaveLength(0)
  })

  it('keeps Hungarian events on the HUF Price', async () => {
    const db = database()
    mocks.createSupabaseClient.mockResolvedValue(db.client)
    mocks.createSession.mockResolvedValue({
      id: 'cs_test_ourfilm_huf',
      url: 'https://checkout.stripe.com/c/pay/cs_test_ourfilm_huf',
    })

    await createEventCheckoutUrl({ ...checkout, locale: 'hu' })

    expect(mocks.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: 'price_test_ourfilm_huf', quantity: 1 }],
        locale: 'hu',
      }),
      expect.any(Object),
    )
  })
})
