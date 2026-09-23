import 'server-only'

import type { BillingCountry, CheckoutReadiness } from '@/lib/billing-country'
import { billingoIsConfigured } from '@/lib/billingo/env'
import { REPRESENTATIVE_COUNTRIES, settlementFor } from '@/lib/settlement'
import { stripeIsConfigured } from '@/lib/stripe/env'

/**
 * Whether this deployment can actually take money from a buyer in this
 * country.
 *
 * The two arrangements have different requirements. A buyer outside Hungary
 * settles through Managed Payments, where Link is the merchant of record and
 * issues the customer's document, and needs nothing but Stripe. A Hungarian
 * buyer is a direct sale by OurFilm once `OURFILM_HU_DIRECT` is on, which
 * means an invoice has to be issued and reported to NAV — so without Billingo
 * the honest answer is that checkout for that country is not switched on.
 *
 * Deliberately not a single flag over both: ANDing them would take
 * international checkout down on any deployment that has no Billingo keys,
 * which is every preview and every dev machine that has not asked for them.
 */
export function checkoutIsConfigured(country: BillingCountry): boolean {
  return checkoutBlockedReason(country) === null
}

/**
 * Why not, in the vocabulary `checkout_blocked` reports.
 *
 * Null when checkout is available. Stripe is named first because without it
 * nothing works for anyone.
 */
export function checkoutBlockedReason(
  country: BillingCountry,
): 'stripe_not_configured' | 'billingo_not_configured' | null {
  if (!stripeIsConfigured()) return 'stripe_not_configured'
  // Billingo is required only where OurFilm is actually the seller. While the
  // cutover flag is off a Hungarian buyer still settles through Managed
  // Payments, and demanding an invoicing provider for a sale Link documents
  // would switch off a checkout that works.
  if (settlementFor(country) === 'direct' && !billingoIsConfigured()) {
    return 'billingo_not_configured'
  }
  return null
}

/** Both answers at once, for a screen that renders before a country is chosen. */
export function checkoutReadiness(): CheckoutReadiness {
  return {
    domestic: checkoutIsConfigured(REPRESENTATIVE_COUNTRIES.domestic),
    international: checkoutIsConfigured(REPRESENTATIVE_COUNTRIES.international),
    domesticSettlement: settlementFor(REPRESENTATIVE_COUNTRIES.domestic),
  }
}
