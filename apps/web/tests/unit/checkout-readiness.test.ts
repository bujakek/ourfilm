import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  checkoutBlockedReason,
  checkoutIsConfigured,
} from '@/lib/checkout-readiness'

afterEach(() => {
  vi.unstubAllEnvs()
})

function stripeConfigured() {
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_x')
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_x')
  vi.stubEnv('STRIPE_PRICE_EVENT', 'price_huf')
  vi.stubEnv('STRIPE_PRICE_EVENT_USD', 'price_usd')
}

function billingoConfigured() {
  vi.stubEnv('BILLINGO_API_KEY', 'test-key')
  vi.stubEnv('BILLINGO_BLOCK_ID', '12')
  vi.stubEnv('BILLINGO_BANK_ACCOUNT_ID', '34')
}

describe('checkout readiness', () => {
  it('needs nothing but Stripe to sell an English event', () => {
    stripeConfigured()

    // Link is the merchant of record there and issues the document, so a
    // deployment with no Billingo keys is a correctly configured one.
    expect(checkoutIsConfigured('en')).toBe(true)
    expect(checkoutBlockedReason('en')).toBeNull()
  })

  it('needs Billingo as well to sell a Hungarian event', () => {
    stripeConfigured()

    // A Hungarian sale is OurFilm's own: the invoice and its NAV report are
    // ours to produce, and there is no way to make that right after the fact.
    expect(checkoutIsConfigured('hu')).toBe(false)
    expect(checkoutBlockedReason('hu')).toBe('billingo_not_configured')

    billingoConfigured()
    expect(checkoutIsConfigured('hu')).toBe(true)
    expect(checkoutBlockedReason('hu')).toBeNull()
  })

  it('reports the missing payment processor before the missing invoicer', () => {
    billingoConfigured()

    // Without Stripe nothing works in either locale, and naming Billingo
    // first would send somebody to fix the wrong dashboard.
    expect(checkoutBlockedReason('hu')).toBe('stripe_not_configured')
    expect(checkoutBlockedReason('en')).toBe('stripe_not_configured')
  })

  it('refuses a live Stripe key anywhere but production', () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_live_realmoney')
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_x')
    vi.stubEnv('STRIPE_PRICE_EVENT', 'price_huf')
    vi.stubEnv('STRIPE_PRICE_EVENT_USD', 'price_usd')
    billingoConfigured()

    // A live key scoped to "Production and Preview" makes every preview URL
    // able to charge a real card — and Stripe delivers webhooks to the
    // production URL, so that charge is never reported back: money moves with
    // no paid row, no unlocked album and no invoice.
    vi.stubEnv('VERCEL_ENV', 'preview')
    expect(checkoutIsConfigured('hu')).toBe(false)
    expect(checkoutIsConfigured('en')).toBe(false)
    expect(checkoutBlockedReason('en')).toBe('stripe_not_configured')

    vi.stubEnv('VERCEL_ENV', 'production')
    expect(checkoutIsConfigured('en')).toBe(true)
  })

  it('leaves a test key alone in every environment', () => {
    stripeConfigured()
    billingoConfigured()
    for (const where of ['preview', 'development', 'production']) {
      vi.stubEnv('VERCEL_ENV', where)
      expect(checkoutIsConfigured('hu')).toBe(true)
    }
  })

  it('does not take English checkout down with Hungarian invoicing', () => {
    stripeConfigured()

    // The regression this file exists for: ANDing the two flags would switch
    // off every preview and dev machine that has no Billingo keys.
    expect(checkoutIsConfigured('en')).toBe(true)
    expect(checkoutIsConfigured('hu')).toBe(false)
  })
})
