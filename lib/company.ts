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
 * **Every value marked TODO must be filled in before the pages are
 * published.** They are the details only the business has, and inventing them
 * would be worse than leaving them visibly blank. `hasRealCompanyDetails`
 * below is what un-drafts the pages, so filling these in and flipping that
 * flag is the whole job.
 *
 * Hungarian law requires each of these on a consumer-facing service:
 * 45/2014. (II. 26.) Korm. rendelet 11. § and the Elker tv. (2001. évi CVIII.).
 */
export const COMPANY = {
  /** Full name as registered, e.g. "Példa Péter e.v." */
  name: '[NÉV — TODO]',
  /** Székhely, full postal address. */
  seat: '[SZÉKHELY — TODO]',
  /**
   * Nyilvántartási szám from the EVNY — **not** a cégjegyzékszám. It is the
   * number on the egyéni vállalkozói igazolvány / the EVNY record.
   */
  registryNumber: '[NYILVÁNTARTÁSI SZÁM — TODO]',
  /** Adószám, e.g. "12345678-1-42". */
  taxNumber: '[ADÓSZÁM — TODO]',
  /** A reachable phone number. Required; an email address alone is not enough. */
  phone: '[TELEFONSZÁM — TODO]',
  /** Chamber of commerce, e.g. "Budapesti Kereskedelmi és Iparkamara". */
  chamber: '[SZAKMAI KAMARA — TODO]',
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
export const LEGAL_VERSION = '2026-08-29-mor-hu'

/** Shown at the foot of the legal pages. Update when their text changes. */
export const LAST_UPDATED = '2026. augusztus 29.'

/**
 * Flips the legal pages *and* the price page out of draft: hides the
 * DraftNotice banners on the two legal pages and lets all three be indexed.
 * /arak carries no banner any more — its copy is final — but it stays out of
 * search results on the same flag, for the reason below.
 *
 * Keep false until COMPANY above is real. Publishing a privacy notice that
 * says `[NÉV — TODO]` is worse than not publishing one, and /arak is gated on
 * the same flag for a sharper reason — a price a stranger can find in Google
 * is an offer, and an offer cannot lawfully be made to a consumer while the
 * mandatory identifiers are placeholders.
 */
export const hasRealCompanyDetails = false
