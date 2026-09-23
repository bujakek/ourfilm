import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  type BillingCountry,
  checkBillingCountry,
  eventPricingFor,
  MANAGED_PAYMENTS_COUNTRIES,
  parseBillingCountry,
  suggestedBillingCountry,
} from '@/lib/billing-country'
import { eventPriceLabelFor } from '@/lib/pricing'
import { settlementFor } from '@/lib/settlement'

afterEach(() => {
  vi.unstubAllEnvs()
})

const country = (code: string) => parseBillingCountry(code) as BillingCountry

describe('billing country', () => {
  it('accepts a supported ISO code in any case', () => {
    expect(parseBillingCountry('HU')).toBe('HU')
    expect(parseBillingCountry(' de ')).toBe('DE')
  })

  it('tells a missing country from an unsupported one', () => {
    expect(checkBillingCountry(undefined)).toEqual({
      ok: false,
      reason: 'billing_country_missing',
    })
    expect(checkBillingCountry('')).toEqual({
      ok: false,
      reason: 'billing_country_missing',
    })
    // Outside Managed Payments' tax coverage, or restricted outright.
    for (const code of ['RU', 'CN', 'BR', 'XX']) {
      expect(checkBillingCountry(code)).toEqual({
        ok: false,
        reason: 'billing_country_unsupported',
      })
    }
  })

  it('refuses anything that is not a bare country code', () => {
    for (const value of ['direct', 'managed', 'HUN', 'H', 'HU;', 42, {}]) {
      expect(parseBillingCountry(value)).toBeNull()
    }
  })

  it('never lists Hungary as a Managed Payments market', () => {
    expect(MANAGED_PAYMENTS_COUNTRIES).not.toContain('HU')
  })

  it('prices by country with the existing Prices, never by language', () => {
    expect(eventPricingFor(country('HU'))).toEqual({
      priceKey: 'eventPriceId',
      currency: 'huf',
    })
    expect(eventPricingFor(country('AT'))).toEqual({
      priceKey: 'eventPriceUsdId',
      currency: 'usd',
    })
    expect(eventPriceLabelFor(country('HU'))).toBe('12 900 Ft')
    expect(eventPriceLabelFor(country('US'))).toBe('39 USD')
  })

  it('routes Hungary direct and everywhere else to Managed Payments', () => {
    vi.stubEnv('OURFILM_HU_DIRECT', 'true')
    expect(settlementFor(country('HU'))).toBe('direct')
    expect(settlementFor(country('DE'))).toBe('managed')
    expect(settlementFor(country('US'))).toBe('managed')
  })

  it('keeps Hungary on Managed Payments until the cutover, never the reverse', () => {
    vi.stubEnv('OURFILM_HU_DIRECT', 'false')
    expect(settlementFor(country('HU'))).toBe('managed')
    expect(settlementFor(country('DE'))).toBe('managed')
  })

  it('takes an IP country only as a suggestion it can validate', () => {
    expect(suggestedBillingCountry('hu')).toBe('HU')
    expect(suggestedBillingCountry('RU')).toBeNull()
    expect(suggestedBillingCountry(null)).toBeNull()
  })
})
