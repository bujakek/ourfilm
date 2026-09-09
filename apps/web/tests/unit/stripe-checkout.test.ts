import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  expireSession: vi.fn(),
  createSupabaseClient: vi.fn(),
}))

vi.mock('@/lib/request-origin', () => ({
  requestOrigin: () => Promise.resolve('http://localhost:3000'),
}))

vi.mock('@/lib/stripe/client', () => ({
  getStripe: () => ({
    checkout: {
      sessions: { create: mocks.createSession, expire: mocks.expireSession },
    },
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
  insertError = null,
}: { reservationError?: unknown; insertError?: unknown } = {}) {
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
            return Promise.resolve({ error: insertError })
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
    mocks.expireSession.mockReset()
    mocks.expireSession.mockResolvedValue({})
    mocks.createSupabaseClient.mockReset()
    // Most of these assert the post-cutover behaviour. The flag's own effect
    // has a test of its own below.
    vi.stubEnv('OURFILM_HU_DIRECT', 'true')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  /** What Stripe answers with, for the currency the locale implies. */
  function sessionFor(locale: 'en' | 'hu', id = 'cs_test_ourfilm') {
    return {
      id,
      url: `https://checkout.stripe.com/c/pay/${id}`,
      amount_total: locale === 'en' ? 3900 : 1290000,
      currency: locale === 'en' ? 'usd' : 'huf',
    }
  }

  it('uses the reserved attempt as the Stripe idempotency boundary', async () => {
    const db = database()
    mocks.createSupabaseClient.mockResolvedValue(db.client)
    mocks.createSession.mockResolvedValue(sessionFor('en'))

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
      settlement: 'managed',
      amount_minor: 3900,
      currency: 'usd',
      status: 'pending',
    })
    // Derived, never random: two concurrent callers share one idempotency key
    // and so must send byte-identical parameters. It also becomes Billingo's
    // `vendor_id`.
    expect(db.inserts[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
    expect(db.inserts[1].id).toBe(db.inserts[0].id)
    expect(firstParams.metadata.purchase_id).toBe(db.inserts[0].id)
  })

  it('gives a changed request its own idempotency key and purchase id', async () => {
    // The live outage this exists for. A reservation is held for 45 minutes,
    // so a host who pressed pay before `OURFILM_HU_DIRECT` was flipped and
    // again after sent one key with two different requests, and Stripe
    // refused: "Keys for idempotent requests can only be used with the same
    // parameters they were first used with." Any deploy that adds a session
    // parameter mid-attempt does the same thing.
    const before = database()
    mocks.createSupabaseClient.mockResolvedValue(before.client)
    mocks.createSession.mockResolvedValue(sessionFor('hu', 'cs_before'))
    vi.stubEnv('OURFILM_HU_DIRECT', 'false')
    await createEventCheckoutUrl({ ...checkout, locale: 'hu' })

    const after = database()
    mocks.createSupabaseClient.mockResolvedValue(after.client)
    mocks.createSession.mockResolvedValue(sessionFor('hu', 'cs_after'))
    vi.stubEnv('OURFILM_HU_DIRECT', 'true')
    await createEventCheckoutUrl({ ...checkout, locale: 'hu' })

    const [, firstOptions] = mocks.createSession.mock.calls[0]
    const [, secondOptions] = mocks.createSession.mock.calls[1]

    // Same event, same attempt — and that is exactly why the key must carry
    // more than those two.
    expect(firstOptions.idempotencyKey).toContain(before.reservation.attempt_id)
    expect(secondOptions.idempotencyKey).toContain(after.reservation.attempt_id)
    expect(firstOptions.idempotencyKey).not.toBe(secondOptions.idempotencyKey)

    // And a distinct purchase id, because the row the first request wrote is
    // still there and the host's client has no update policy to repair it.
    expect(before.inserts[0].id).not.toBe(after.inserts[0].id)
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
    mocks.createSession.mockResolvedValue(sessionFor('hu', 'cs_test_huf'))

    await createEventCheckoutUrl({ ...checkout, locale: 'hu' })

    expect(mocks.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: 'price_test_ourfilm_huf', quantity: 1 }],
        locale: 'hu',
      }),
      expect.any(Object),
    )
  })

  // The two halves of the split, asserted from both sides. Without these a
  // later tidy-up that collapses the branch back into one session shape is
  // invisible until a Hungarian host cannot pay with Apple Pay, or an English
  // one is asked for a Hungarian invoice address.
  it('sells a Hungarian event directly, and collects what an invoice needs', async () => {
    const db = database()
    mocks.createSupabaseClient.mockResolvedValue(db.client)
    mocks.createSession.mockResolvedValue(sessionFor('hu', 'cs_test_huf'))

    await createEventCheckoutUrl({ ...checkout, locale: 'hu' })

    const [params] = mocks.createSession.mock.calls[0]
    expect(params.managed_payments).toBeUndefined()
    expect(params.billing_address_collection).toBe('required')
    expect(params.customer_creation).toBe('always')
    expect(params.consent_collection).toEqual({
      terms_of_service: 'required',
    })
    // Not decoration: Stripe refuses `consent_collection.terms_of_service`
    // unless the account has a ToS URL in its public business details or the
    // request carries its own acceptance message. Without this, every
    // Hungarian checkout 400s.
    expect(params.custom_text?.terms_of_service_acceptance?.message).toContain(
      'ÁSZF',
    )
    // Alanyi adómentes: there is no VAT for Stripe to calculate, and the
    // document that satisfies Hungarian law is the Billingo invoice.
    expect(params.automatic_tax).toBeUndefined()
    expect(params.invoice_creation).toBeUndefined()
    expect(params.metadata.settlement).toBe('direct')
    expect(db.inserts[0]).toMatchObject({
      settlement: 'direct',
      amount_minor: 1290000,
      currency: 'huf',
    })
  })

  it('keeps an English event on Managed Payments and asks for no address', async () => {
    const db = database()
    mocks.createSupabaseClient.mockResolvedValue(db.client)
    mocks.createSession.mockResolvedValue(sessionFor('en'))

    await createEventCheckoutUrl(checkout)

    const [params] = mocks.createSession.mock.calls[0]
    // Link is the merchant of record: it issues the document, so OurFilm has
    // no invoice to raise and no reason to ask for a billing address.
    expect(params.managed_payments).toEqual({ enabled: true })
    expect(params.billing_address_collection).toBeUndefined()
    expect(params.consent_collection).toBeUndefined()
    expect(params.metadata.settlement).toBe('managed')
  })

  it('expires the session rather than sell a direct event it cannot invoice', async () => {
    const db = database({ insertError: new Error('ledger unavailable') })
    mocks.createSupabaseClient.mockResolvedValue(db.client)
    mocks.createSession.mockResolvedValue(sessionFor('hu', 'cs_test_huf'))

    // `purchases.id` is already promised to Billingo as its idempotency key,
    // so a session whose row does not exist must not be handed to a host.
    await expect(
      createEventCheckoutUrl({ ...checkout, locale: 'hu' }),
    ).rejects.toThrow('ledger unavailable')
    expect(mocks.expireSession).toHaveBeenCalledWith('cs_test_huf')
  })

  it('still sells a Managed Payments event when the ledger insert fails', async () => {
    const db = database({ insertError: new Error('ledger unavailable') })
    mocks.createSupabaseClient.mockResolvedValue(db.client)
    mocks.createSession.mockResolvedValue(sessionFor('en'))

    // Link issues that document; the row is a trace, not a precondition.
    await expect(createEventCheckoutUrl(checkout)).resolves.toContain(
      'checkout.stripe.com',
    )
    expect(mocks.expireSession).not.toHaveBeenCalled()
  })

  it('refuses a Price that returns the wrong currency', async () => {
    const db = database()
    mocks.createSupabaseClient.mockResolvedValue(db.client)
    // A HUF event pointed at the USD Price: invisible until a host has paid
    // and Billingo refuses to put the amount on a forint invoice.
    mocks.createSession.mockResolvedValue(sessionFor('en', 'cs_test_wrong'))

    await expect(
      createEventCheckoutUrl({ ...checkout, locale: 'hu' }),
    ).rejects.toThrow('HUF')
    expect(mocks.expireSession).toHaveBeenCalledWith('cs_test_wrong')
    expect(db.inserts).toHaveLength(0)
  })
})
