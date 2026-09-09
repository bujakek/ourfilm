import 'server-only'

import { billingoIsConfigured } from '@/lib/billingo/env'
import type { Locale } from '@/lib/i18n'
import { settlementFor } from '@/lib/settlement'
import { stripeIsConfigured } from '@/lib/stripe/env'

/**
 * Whether this deployment can actually take money for an event in this locale.
 *
 * The two locales are sold under different arrangements, so they have
 * different requirements. An English event settles through Managed Payments,
 * where Link is the merchant of record and issues the customer's document, and
 * needs nothing but Stripe. A Hungarian event is a direct sale by OurFilm,
 * which means an invoice has to be issued and reported to NAV — so without
 * Billingo the honest answer is that Hungarian checkout is not switched on.
 *
 * Deliberately not a single flag over both: ANDing them would take English
 * checkout down on any deployment that has no Billingo keys, which is every
 * preview and every dev machine that has not asked for them.
 */
export function checkoutIsConfigured(locale: Locale): boolean {
  if (!stripeIsConfigured()) return false
  // Billingo is required only where OurFilm is actually the seller. While the
  // cutover flag is off a Hungarian event still settles through Managed
  // Payments, and demanding an invoicing provider for a sale Link documents
  // would switch off a checkout that works.
  return settlementFor(locale) === 'direct' ? billingoIsConfigured() : true
}

/**
 * Why not, in the vocabulary `checkout_blocked` reports.
 *
 * Null when checkout is available. Stripe is named first because without it
 * nothing works in either locale.
 */
export function checkoutBlockedReason(
  locale: Locale,
): 'stripe_not_configured' | 'billingo_not_configured' | null {
  if (!stripeIsConfigured()) return 'stripe_not_configured'
  if (settlementFor(locale) === 'direct' && !billingoIsConfigured()) {
    return 'billingo_not_configured'
  }
  return null
}
