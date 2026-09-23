import 'server-only'

import {
  type BillingCountry,
  DOMESTIC_BILLING_COUNTRY,
  isDomesticBillingCountry,
} from '@/lib/billing-country'

/**
 * Which arrangement sells an event, and therefore who issues the document.
 *
 * `managed` is Stripe Managed Payments: Link, LLC is the merchant of record,
 * remits the indirect taxes and issues the customer-facing document. `direct`
 * is an ordinary Stripe charge with OurFilm as the seller, which is what makes
 * a Hungarian invoice — and its NAV Online Számla report — our own obligation.
 */
export type Settlement = 'managed' | 'direct'

/**
 * The cutover switch for Hungarian direct sales.
 *
 * Off, a Hungarian event settles through Managed Payments exactly as it always
 * has. On, it becomes a direct sale that OurFilm invoices through Billingo.
 * The same shape as `OURFILM_EXPORT_WORKER`, and for the same reason: the code
 * can ship long before the operational side of it is ready, and the thing that
 * decides which is running should be a variable rather than a revert.
 *
 * What has to be true before flipping it:
 *
 *   - Apple Pay confirmed on HUF outside Managed Payments, on a real device.
 *     That is the entire reason the split exists; without it the change buys
 *     invoicing, NAV reporting and chargeback liability for nothing.
 *   - A live Billingo invoice block whose prefix is fit to print on a real
 *     customer's invoice, since an issued number can never be changed.
 *   - `BILLINGO_BLOCK_ID` and `BILLINGO_BANK_ACCOUNT_ID` set on Production and
 *     belonging to the same profile as `BILLINGO_API_KEY`.
 *   - A Terms of service URL on the live Stripe account, so the consent
 *     checkbox links to the ÁSZF a consumer is agreeing to.
 *
 * Flipping it back is safe: `purchases.settlement` records what each sale
 * actually was, so rows written while it was on keep being invoiced and rows
 * written while it was off are never touched by Billingo.
 */
export function huDirectSalesEnabled(): boolean {
  return process.env.OURFILM_HU_DIRECT === 'true'
}

/**
 * Keyed on the confirmed billing country, never on the interface language.
 *
 * A Hungarian billing address is a direct sale — OurFilm is the seller and
 * issues the invoice — whichever language the host reads the site in. Every
 * other supported country settles through Managed Payments, where Link is the
 * merchant of record and issues its own document.
 *
 * While `OURFILM_HU_DIRECT` is off a Hungarian address still settles through
 * Managed Payments, in HUF, exactly as Hungarian events did before the split.
 * The reverse never happens: nothing here falls back to a direct sale because
 * Managed Payments is unavailable. A non-Hungarian buyer is never OurFilm's
 * own sale, because Billingo can only invoice a Hungarian address.
 *
 * Decided once, when the Checkout Session is created, and stored on the
 * purchase. Every later reader — the webhook, the invoice sweep, a refund —
 * reads `purchases.settlement` and never calls this again, so neither a
 * language switch nor an edited profile can reclassify a sale.
 */
export function settlementFor(country: BillingCountry): Settlement {
  if (!isDomesticBillingCountry(country)) return 'managed'
  return huDirectSalesEnabled() ? 'direct' : 'managed'
}

/** A representative non-domestic country, for "can we sell abroad at all". */
const ANY_INTERNATIONAL = 'DE' as BillingCountry

/** Both arrangements, for screens that ask before a country is chosen. */
export const REPRESENTATIVE_COUNTRIES = {
  domestic: DOMESTIC_BILLING_COUNTRY,
  international: ANY_INTERNATIONAL,
} as const
