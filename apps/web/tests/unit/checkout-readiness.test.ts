import { afterEach, describe, expect, it, vi } from 'vitest'

import { type BillingCountry, parseBillingCountry } from '@/lib/billing-country'
import {
  checkoutBlockedReason,
  checkoutIsConfigured,
  checkoutReadiness,
} from '@/lib/checkout-readiness'

// Readiness is keyed on the billing country now. These stand for the two sides
// of the routing boundary the old locale keys used to approximate.
const HU = parseBillingCountry('HU') as BillingCountry
const DE = parseBillingCountry('DE') as BillingCountry

afterEach(() => {
  vi.unstubAllEnvs()
})

function stripeConfigured() {
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_x')
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_x')
  vi.stubEnv('STRIPE_PRICE_EVENT', 'price_huf')
  vi.stubEnv('STRIPE_PRICE_EVENT_USD', 'price_usd')
}

/** The cutover: Hungarian events only become direct sales when this is on. */
function huDirect(on: boolean) {
  vi.stubEnv('OURFILM_HU_DIRECT', on ? 'true' : 'false')
}

function billingoConfigured() {
  vi.stubEnv('BILLINGO_API_KEY', 'test-key')
  vi.stubEnv('BILLINGO_BLOCK_ID', '12')
  vi.stubEnv('BILLINGO_BANK_ACCOUNT_ID', '34')
}

describe('checkout readiness', () => {
  it('needs nothing but Stripe to sell to a non-Hungarian billing address', () => {
    stripeConfigured()
    huDirect(true)

    // Link is the merchant of record there and issues the document, so a
    // deployment with no Billingo keys is a correctly configured one.
    expect(checkoutIsConfigured(DE)).toBe(true)
    expect(checkoutBlockedReason(DE)).toBeNull()
  })

  it('needs Billingo as well to sell to a Hungarian billing address', () => {
    stripeConfigured()
    huDirect(true)

    // A Hungarian sale is OurFilm's own: the invoice and its NAV report are
    // ours to produce, and there is no way to make that right after the fact.
    expect(checkoutIsConfigured(HU)).toBe(false)
    expect(checkoutBlockedReason(HU)).toBe('billingo_not_configured')

    billingoConfigured()
    expect(checkoutIsConfigured(HU)).toBe(true)
    expect(checkoutBlockedReason(HU)).toBeNull()
  })

  it('reports the missing payment processor before the missing invoicer', () => {
    billingoConfigured()
    huDirect(true)

    // Without Stripe nothing works in either locale, and naming Billingo
    // first would send somebody to fix the wrong dashboard.
    expect(checkoutBlockedReason(HU)).toBe('stripe_not_configured')
    expect(checkoutBlockedReason(DE)).toBe('stripe_not_configured')
  })

  it('refuses a live Stripe key anywhere but production', () => {
    huDirect(true)
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
    expect(checkoutIsConfigured(HU)).toBe(false)
    expect(checkoutIsConfigured(DE)).toBe(false)
    expect(checkoutBlockedReason(DE)).toBe('stripe_not_configured')

    vi.stubEnv('VERCEL_ENV', 'production')
    expect(checkoutIsConfigured(DE)).toBe(true)
  })

  it('leaves a test key alone in every environment', () => {
    stripeConfigured()
    billingoConfigured()
    huDirect(true)
    for (const where of ['preview', 'development', 'production']) {
      vi.stubEnv('VERCEL_ENV', where)
      expect(checkoutIsConfigured(HU)).toBe(true)
    }
  })

  it('does not take international checkout down with Hungarian invoicing', () => {
    stripeConfigured()
    huDirect(true)

    // The regression this file exists for: ANDing the two flags would switch
    // off every preview and dev machine that has no Billingo keys.
    expect(checkoutIsConfigured(DE)).toBe(true)
    expect(checkoutIsConfigured(HU)).toBe(false)
  })

  it('asks for no Billingo while the cutover flag is off', () => {
    stripeConfigured()
    huDirect(false)

    // The state this merges in: Hungarian events still settle through Managed
    // Payments, Link issues the document, and demanding an invoicing provider
    // for a sale we do not invoice would switch off a checkout that works.
    expect(checkoutIsConfigured(HU)).toBe(true)
    expect(checkoutBlockedReason(HU)).toBeNull()
  })

  it('starts asking for Billingo the moment the flag is flipped', () => {
    stripeConfigured()
    huDirect(true)

    expect(checkoutIsConfigured(HU)).toBe(false)
    expect(checkoutBlockedReason(HU)).toBe('billingo_not_configured')
  })

  it('reports both sides of the boundary for a screen with no country yet', () => {
    stripeConfigured()
    huDirect(true)

    expect(checkoutReadiness()).toEqual({
      domestic: false,
      international: true,
      domesticSettlement: 'direct',
    })

    huDirect(false)
    expect(checkoutReadiness()).toEqual({
      domestic: true,
      international: true,
      domesticSettlement: 'managed',
    })
  })
})
