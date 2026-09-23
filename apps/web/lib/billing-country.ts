import type { Locale } from '@/lib/i18n'

/**
 * Where a buyer is billed, and the commercial terms that follow from it.
 *
 * This is the one input that decides how an event is sold. The interface
 * language does not: an English-speaking host with a Hungarian address is a
 * Hungarian sale, and a Hungarian speaker billed in Vienna is not. Nor does
 * the event's locale, the browser's IP, the currency on a marketing page or
 * anything the browser claims about a payment flow — the host confirms a
 * country, the server validates it against the list below, and everything
 * else is derived here and in `lib/settlement.ts`.
 *
 * Client-safe and pure, so the select on the billing card and the server
 * action that creates the Checkout Session read the same list and the same
 * prices and cannot disagree about either.
 */

/** ISO 3166-1 alpha-2, upper case. Only values from `parseBillingCountry`. */
export type BillingCountry = string & {
  readonly __billingCountry: unique symbol
}

/** Sold directly by OurFilm, invoiced through Billingo. */
export const DOMESTIC_BILLING_COUNTRY = 'HU' as BillingCountry

/**
 * Customer countries sold through Stripe Managed Payments.
 *
 * Not every country Managed Payments will take a card from: its eligibility
 * page accepts buyers from 195+ countries, but Link only assumes the indirect
 * tax liability for the ones on its cross-border tax-coverage list. Outside
 * that list the seller is left "responsible for handling all compliance
 * requirements", which is exactly what selling through a merchant of record
 * is meant to avoid. So this is that list, as published at
 * https://docs.stripe.com/payments/managed-payments/tax-compliance#cross-border-sales
 * (read 2026-09-23), minus HU, which is sold domestically.
 *
 * Changing it is a commercial decision, not a code tidy-up. Re-read that page
 * before adding a country; removing one only stops new checkouts.
 */
export const MANAGED_PAYMENTS_COUNTRIES = [
  // Africa
  'CM', 'EG', 'GH', 'KE', 'NG', 'UG', 'ZA', 'ZM', 'ZW',
  // Asia Pacific
  'AM', 'AU', 'AZ', 'BN', 'GE', 'HK', 'ID', 'IL', 'IN', 'JP', 'KG', 'KR', 'KW',
  'KZ', 'LA', 'MO', 'MY', 'NP', 'NZ', 'PH', 'QA', 'SA', 'SG', 'TH', 'TJ', 'TR',
  'TW', 'VN',
  // Europe outside the EU
  'AL', 'BY', 'CH', 'GB', 'GI', 'IS', 'LI', 'MD', 'NO', 'RS', 'UA',
  // European Union, less Hungary
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR',
  'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
  // Latin America and the Caribbean
  'BB', 'BM', 'KY', 'MX', 'VG',
  // North America
  'CA', 'US',
] as const // prettier-ignore

const SUPPORTED = new Set<string>([
  DOMESTIC_BILLING_COUNTRY,
  ...MANAGED_PAYMENTS_COUNTRIES,
])

const ISO_ALPHA_2 = /^[A-Z]{2}$/

export type BillingCountryCheck =
  | { ok: true; country: BillingCountry }
  | {
      ok: false
      reason: 'billing_country_missing' | 'billing_country_unsupported'
    }

/**
 * Validates what a form, a draft or Stripe metadata says the country is.
 *
 * Distinguishes "nothing chosen" from "chosen but not a market we sell in",
 * because the host reads two different sentences for them.
 */
export function checkBillingCountry(value: unknown): BillingCountryCheck {
  if (typeof value !== 'string' || value.trim() === '') {
    return { ok: false, reason: 'billing_country_missing' }
  }
  const code = value.trim().toUpperCase()
  if (!ISO_ALPHA_2.test(code) || !SUPPORTED.has(code)) {
    return { ok: false, reason: 'billing_country_unsupported' }
  }
  return { ok: true, country: code as BillingCountry }
}

export function parseBillingCountry(value: unknown): BillingCountry | null {
  const check = checkBillingCountry(value)
  return check.ok ? check.country : null
}

export function isDomesticBillingCountry(country: BillingCountry): boolean {
  return country === DOMESTIC_BILLING_COUNTRY
}

/**
 * The server's price for a buyer, keyed on the billing country.
 *
 * The two Prices are the ones that already exist — 12 900 Ft and 39 USD on the
 * same product — and nothing about them changed. What changed is the key: they
 * used to follow the interface language, which put a Hungarian buyer reading
 * the English site on a dollar price and a Hungarian invoice path at once.
 *
 * `priceKey` names a field of `StripeEnv`; the Price ID itself never leaves
 * the server and is never read from a request.
 */
export type EventPricing = {
  priceKey: 'eventPriceId' | 'eventPriceUsdId'
  currency: 'huf' | 'usd'
}

export function eventPricingFor(country: BillingCountry): EventPricing {
  return isDomesticBillingCountry(country)
    ? { priceKey: 'eventPriceId', currency: 'huf' }
    : { priceKey: 'eventPriceUsdId', currency: 'usd' }
}

/**
 * Whether checkout can be offered, per side of the routing boundary, for a
 * screen that renders before a country is chosen. `domestic` is a Hungarian
 * billing address, `international` every other supported one. Computed by
 * `checkoutReadiness()` on the server.
 */
export type CheckoutReadiness = {
  domestic: boolean
  international: boolean
  /** How a Hungarian address settles today — `managed` until the
   *  `OURFILM_HU_DIRECT` cutover. Only ever used to name the seller. */
  domesticSettlement: 'direct' | 'managed'
}

export function checkoutReadyFor(
  readiness: CheckoutReadiness,
  country: BillingCountry,
): boolean {
  return isDomesticBillingCountry(country)
    ? readiness.domestic
    : readiness.international
}

/** The country's name in the reader's language, for the select and receipts. */
export function billingCountryName(country: string, locale: Locale): string {
  try {
    return (
      new Intl.DisplayNames([locale === 'hu' ? 'hu' : 'en'], {
        type: 'region',
      }).of(country) ?? country
    )
  } catch {
    return country
  }
}

/** Every supported country, alphabetised in the reader's language. */
export function billingCountryOptions(
  locale: Locale,
): { code: BillingCountry; name: string }[] {
  const collator = new Intl.Collator(locale)
  return [...SUPPORTED]
    .map((code) => ({
      code: code as BillingCountry,
      name: billingCountryName(code, locale),
    }))
    .sort((a, b) => collator.compare(a.name, b.name))
}

/**
 * A country to put at the top of the list, from a request header.
 *
 * Only ever a suggestion. The select still starts empty unless the host has
 * confirmed a country before; an IP address says where a phone is, not where
 * its owner is billed.
 */
export function suggestedBillingCountry(
  ipCountry: string | null | undefined,
): BillingCountry | null {
  return parseBillingCountry(ipCountry)
}
