/**
 * What one event costs, as a host reads it.
 *
 * The authoritative amounts are the locale-specific Stripe Prices — these are
 * only offline-safe labels shared by every screen that quotes the purchase.
 * A price that disagrees with itself across two screens of the same product is
 * worse than either number.
 *
 * Client-safe on purpose. `lib/billing.ts` is `server-only` (it reads the
 * database), and both of the components that need this line are client
 * components.
 *
 * If a Price in Stripe changes, this changes with it. Nothing derives one
 * from the other: reading the Price over the API to render a label would put a
 * network call on a screen that must work offline in a venue.
 */
import type { Locale } from './i18n'

export const EVENT_PRICE_LABELS: Record<Locale, string> = {
  en: '39 USD',
  hu: '12 900 Ft',
}

/** The Hungarian label is kept for Hungarian-only legal copy. */
export const EVENT_PRICE_LABEL = EVENT_PRICE_LABELS.hu

export function eventPriceLabel(locale: Locale): string {
  return EVENT_PRICE_LABELS[locale]
}

/**
 * The same price, as a machine reads it.
 *
 * Split from the labels above because `Offer` structured data needs a bare
 * number and an ISO 4217 code where a host needs "12 900 Ft". They are two
 * renderings of one fact, and `tests/unit/pricing.test.ts` asserts the label
 * still spells out the amount — the drift this guards against is a price
 * change applied to the line a host reads and not to the number an answer
 * engine quotes back at them.
 *
 * Major units, not Stripe's minor ones: schema.org `price` is the amount as
 * written on the page, and `lib/billing.ts` already owns the minor-unit
 * conversion for the side that actually moves money.
 */
export const EVENT_PRICE_AMOUNTS: Record<Locale, number> = {
  en: 39,
  hu: 12900,
}

/** ISO 4217, for `priceCurrency`. Matches the currency of the locale's Price. */
export const EVENT_PRICE_CURRENCIES: Record<Locale, string> = {
  en: 'USD',
  hu: 'HUF',
}
