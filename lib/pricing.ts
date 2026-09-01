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
