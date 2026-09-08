/**
 * The provider's facts, in one place so the privacy notice and the ÁSZF can
 * never disagree with each other.
 *
 * **The provider is an egyéni vállalkozó (sole trader), not a company.** That
 * is not a cosmetic distinction: an EV has no cégnév, no cégjegyzékszám and no
 * registering court. It has a name, a nyilvántartási szám in the Egyéni
 * Vállalkozók Nyilvántartása, and an adószám. Printing "Cégjegyzékszám" on a
 * consumer-facing page for an EV is simply a false statement, so the fields
 * below are shaped for the entity that actually exists.
 *
 * These are the operator's registered details. `hasRealCompanyDetails` below
 * is the single switch that publishes the legal and pricing pages once the
 * values have been verified.
 */
export const COMPANY = {
  /** Full name as registered, e.g. "Példa Péter e.v." */
  name: 'Buják László e.v.',
  /** Székhely, full postal address. */
  seat: '1039 Budapest, Juhász Gyula utca 2., 8. em. 75.',
  /**
   * Nyilvántartási szám from the EVNY — **not** a cégjegyzékszám. It is the
   * number on the egyéni vállalkozói igazolvány / the EVNY record.
   */
  registryNumber: '61847981',
  /** Adószám, e.g. "12345678-1-42". */
  taxNumber: '91762351-1-41',
} as const

/**
 * The register an egyéni vállalkozó appears in.
 *
 * Replaces the "nyilvántartó bíróság" a company would name. EVs are not
 * registered by a cégbíróság at all — the EVNY is an administrative register,
 * so naming a court would be inventing an authority that was never involved.
 */
export const REGISTRY = 'Egyéni Vállalkozók Nyilvántartása (EVNY)'

/** Hosting provider named in the ÁSZF, per the Elker tv. */
export const HOSTING_PROVIDER =
  'Vercel Inc. (340 S Lemon Ave #4133, Walnut, CA 91789, USA)'

/**
 * The Managed Payments parties, named in both legal pages.
 *
 * Stripe Payments Europe is the Irish entity EU merchants contract with, so
 * the payment relationship itself stays inside the EEA. Verify this matches
 * the entity on the actual Stripe agreement once the account exists — Stripe
 * assigns it by merchant country, and the address belongs in the ÁSZF as
 * written, not approximated.
 *
 * Sold through Link, LLC is the merchant of record for Managed Payments
 * transactions. Stripe Payments Europe provides the EEA payment services.
 * The exact entities shown in the live Dashboard agreement must be checked
 * before launch; do not replace them with a guessed local Stripe company.
 */
export const PAYMENT_PROCESSOR = {
  name: 'Stripe Payments Europe, Limited',
  address:
    '1 Grand Canal Street Lower, Grand Canal Dock, Dublin, D02 H210, Írország',
  merchantOfRecord: 'Link, LLC',
  checkoutLabel: 'Sold through Link',
  supportUrl: 'https://support.link.com/topics/sold-through-link',
} as const

/** Who sends the magic-link emails. Named as a processor in the privacy notice. */
export const EMAIL_PROVIDER = 'Resend'

/**
 * Version recorded on Stripe Checkout Sessions when a host starts a paid
 * order. Keep this stable until the terms materially change; a display date is
 * not a useful audit trail on its own.
 */
export const LEGAL_VERSION = '2026-08-31-mor-hu'

/** Shown at the foot of the terms and imprint. */
export const LAST_UPDATED = '2026. augusztus 31.'

/** The privacy notice changes independently from the contractual terms. */
export const PRIVACY_LAST_UPDATED = {
  hu: '2026. szeptember 5.',
  en: '5 September 2026',
} as const

/**
 * Flips the legal pages *and* the price page out of draft: hides the
 * DraftNotice banners on the two legal pages and lets all three be indexed.
 * /arak carries no banner any more — its copy is final — but it stays out of
 * search results on the same flag, for the reason below.
 *
 * This stays true while COMPANY above contains verified operator details. If
 * those details ever become incomplete during a change, switch it off in the
 * same commit so draft identifiers cannot be published.
 */
export const hasRealCompanyDetails = true
