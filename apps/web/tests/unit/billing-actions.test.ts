import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createEventCheckoutUrl: vi.fn(async () => 'https://checkout.stripe.com/c/x'),
  reportServerEvent: vi.fn(async () => undefined),
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { url })
  }),
}))

vi.mock('@/lib/stripe/checkout', () => ({
  createEventCheckoutUrl: mocks.createEventCheckoutUrl,
}))
vi.mock('@/lib/telemetry-server', () => ({
  reportServerEvent: mocks.reportServerEvent,
  reportServerIssue: vi.fn(async () => undefined),
}))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: 'owner-id', email: 'host@example.com' } },
      }),
    },
  }),
}))
vi.mock('@/lib/events', () => ({
  // An English event: the language the host reads must not matter below.
  getOwnedEventBySlug: async () => ({
    id: 'event-id',
    slug: 'k3f9x7ab2m',
    locale: 'en',
  }),
}))
vi.mock('@/lib/host-locale', () => ({
  getHostLocale: async (fallback: string) => fallback,
}))
vi.mock('@/lib/billing', () => ({
  getEventQuota: async () => ({ unlimited: false }),
}))

import { startEventCheckout } from '@/app/(product)/host/events/[slug]/billing-actions'

function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

describe('startEventCheckout', () => {
  beforeEach(() => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_x')
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_x')
    vi.stubEnv('STRIPE_PRICE_EVENT', 'price_huf')
    vi.stubEnv('STRIPE_PRICE_EVENT_USD', 'price_usd')
    vi.stubEnv('BILLINGO_API_KEY', 'test-key')
    vi.stubEnv('BILLINGO_BLOCK_ID', '12')
    vi.stubEnv('BILLINGO_BANK_ACCOUNT_ID', '34')
    vi.stubEnv('OURFILM_HU_DIRECT', 'true')
    mocks.createEventCheckoutUrl.mockClear()
    mocks.reportServerEvent.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('takes only the country from the form, whatever else is posted', async () => {
    await expect(
      startEventCheckout(
        { error: null },
        form({
          slug: 'k3f9x7ab2m',
          locale: 'en',
          legal_acceptance: 'on',
          billing_country: 'hu',
          // What a tampered form might add. None of it is read.
          settlement: 'managed',
          payment_flow: 'stripe_managed',
          price: 'price_attacker',
          amount: '1',
          currency: 'usd',
        }),
      ),
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(mocks.createEventCheckoutUrl).toHaveBeenCalledTimes(1)
    const [args] = mocks.createEventCheckoutUrl.mock.calls[0] as unknown as [
      Record<string, unknown>,
    ]
    expect(args.billingCountry).toBe('HU')
    expect(Object.keys(args).sort()).toEqual(
      [
        'billingCountry',
        'eventId',
        'locale',
        'ownerEmail',
        'ownerId',
        'slug',
        'termsAcceptedAt',
      ].sort(),
    )
    // An English page with a Hungarian address is still a direct HUF sale.
    expect(mocks.reportServerEvent).toHaveBeenCalledWith(
      'checkout_started',
      expect.objectContaining({ settlement: 'direct', currency: 'huf' }),
    )
  })

  it('requires a country before anything reaches Stripe', async () => {
    const state = await startEventCheckout(
      { error: null },
      form({ slug: 'k3f9x7ab2m', locale: 'hu', legal_acceptance: 'on' }),
    )
    expect(state.error).toContain('számlázási országot')
    expect(mocks.createEventCheckoutUrl).not.toHaveBeenCalled()
    expect(mocks.reportServerEvent).toHaveBeenCalledWith(
      'checkout_blocked',
      expect.objectContaining({ reason: 'billing_country_missing' }),
    )
  })

  it('refuses a market Managed Payments does not cover', async () => {
    const state = await startEventCheckout(
      { error: null },
      form({
        slug: 'k3f9x7ab2m',
        locale: 'en',
        legal_acceptance: 'on',
        billing_country: 'RU',
      }),
    )
    expect(state.error).toMatch(/cannot take payments/)
    expect(mocks.createEventCheckoutUrl).not.toHaveBeenCalled()
  })

  it('blocks a Hungarian address when Billingo is missing, not a foreign one', async () => {
    vi.stubEnv('BILLINGO_API_KEY', '')
    const hungarian = await startEventCheckout(
      { error: null },
      form({
        slug: 'k3f9x7ab2m',
        locale: 'en',
        legal_acceptance: 'on',
        billing_country: 'HU',
      }),
    )
    expect(hungarian.error).toBeTruthy()
    expect(mocks.createEventCheckoutUrl).not.toHaveBeenCalled()

    await expect(
      startEventCheckout(
        { error: null },
        form({
          slug: 'k3f9x7ab2m',
          locale: 'hu',
          legal_acceptance: 'on',
          billing_country: 'AT',
        }),
      ),
    ).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.createEventCheckoutUrl).toHaveBeenCalledWith(
      expect.objectContaining({ billingCountry: 'AT' }),
    )
  })
})
