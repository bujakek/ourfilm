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
  /**
   * Adószám, e.g. "12345678-1-42".
   *
   * Worth checking the middle digit against reality: `1` marks a taxpayer who
   * charges no VAT, which is what alanyi adómentes looks like. A `2` there
   * would mean the AAM status below is wrong.
   */
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

/**
 * VAT status: alanyi adómentes.
 *
 * Under the Áfa tv. an AAM provider charges no VAT, so the price a guest sees
 * is simply the price — there is no gross/net split to state, and the ÁSZF
 * must not claim the fee is "áfával növelt". Invoices carry the AAM marking.
 *
 * Two things to watch, both of which end the exemption or add an obligation
 * without anyone sending a warning:
 *
 * - There is an annual revenue threshold. Crossing it ends the exemption from
 *   the transaction that crosses it, not from the next tax year. Confirm the
 *   current figure with a könyvelő rather than trusting a number written here.
 * - Buying services from an EU supplier — Stripe Ireland, and likely the other
 *   vendors named in these pages — is reverse charged. An AAM taxpayer then
 *   needs a közösségi adószám and has to self-assess and pay the Hungarian VAT
 *   on those purchases, even though it charges none on its own sales. This is
 *   the obligation most easily missed on the day the first Stripe fee lands.
 */
export const VAT_STATUS = {
  /** The marking an invoice must carry. */
  code: 'AAM',
  label: 'alanyi adómentes',
  /**
   * What a price page must say. Note it states the displayed figure is the
   * final amount payable — consumer pricing rules care about that far more
   * than about the tax mechanism behind it.
   */
  priceNote:
    'A feltüntetett ár a fizetendő végösszeg. A szolgáltató alanyi adómentes (AAM), az ár áfát nem tartalmaz.',
  /**
   * The same fact for /arak, where the reader is deciding whether to buy
   * rather than reading a contract. Separate from `priceNote` because the ÁSZF
   * quotes that one verbatim and a legal document needs the long form.
   */
  pricePageNote:
    'A feltüntetett ár a fizetendő végösszeg. Alanyi adómentes szolgáltatás.',
} as const

/** Hosting provider named in the ÁSZF, per the Elker tv. */
export const HOSTING_PROVIDER =
  'Vercel Inc. (340 S Lemon Ave #4133, Walnut, CA 91789, USA)'

/**
 * The payment processor, named in both legal pages.
 *
 * Stripe Payments Europe is the Irish entity EU merchants contract with, so
 * the payment relationship itself stays inside the EEA. Verify this matches
 * the entity on the actual Stripe agreement once the account exists — Stripe
 * assigns it by merchant country, and the address belongs in the ÁSZF as
 * written, not approximated.
 *
 * Checkout is a hosted redirect (`mode: 'payment'`), so card numbers, 3-D
 * Secure and any wallet credentials go straight to Stripe. This system stores
 * only Stripe's reference ids, the amount, the currency and a status — see
 * the `purchases` table. That distinction is the whole reason the privacy
 * notice can say we never see a card number.
 */
export const PAYMENT_PROCESSOR = {
  name: 'Stripe Payments Europe, Limited',
  address:
    '1 Grand Canal Street Lower, Grand Canal Dock, Dublin, D02 H210, Írország',
} as const

/** Who sends the magic-link emails. Named as a processor in the privacy notice. */
export const EMAIL_PROVIDER = 'Resend'

/**
 * Version recorded on Stripe Checkout Sessions when a host starts a paid
 * order. Keep this stable until the terms materially change; a display date is
 * not a useful audit trail on its own.
 */
export const LEGAL_VERSION = '2026-08-26'

/** Shown at the foot of the legal pages. Update when their text changes. */
export const LAST_UPDATED = '2026. augusztus 26.'

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
