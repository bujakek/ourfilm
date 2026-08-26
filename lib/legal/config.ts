// The public contact mailbox, imported rather than restated: the footer and
// /kapcsolat already publish it, and two addresses would be worse than one
// unverified address. It is still unverified — see `legalBlockers()`.
import { CONTACT_EMAIL } from '@/lib/site'

/**
 * Every fact the legal pages state about the business, in one typed place.
 *
 * The pages themselves contain no company data at all: they render tokens
 * resolved from here, so the ÁSZF, the privacy notice, the impresszum and the
 * processing annex cannot disagree with each other about who the provider is.
 *
 * **Nothing here is invented.** A value that cannot be verified from the
 * repository, the infrastructure or a provider agreement is `MISSING` rather
 * than a plausible-looking string. `MISSING` renders as `HIÁNYZÓ KÖTELEZŐ
 * ADAT` on the page and appears in `legalBlockers()`, which is what keeps a
 * placeholder from being read as a commitment. That is deliberately louder
 * than the `[NÉV — TODO]` convention this replaced: a bracketed
 * TODO looks like copy, a shouted Hungarian sentence does not.
 *
 * Filling these in and watching `legalBlockers()` empty out is the whole
 * pre-launch job.
 */

/** The version stamped on every acceptance record and printed on every page. */
export const LEGAL_VERSION = '2026-08-26' as const
export type LegalVersion = typeof LEGAL_VERSION

/** How the same date reads to a Hungarian visitor. One string, because it is
 *  the first line of six documents. */
export const LEGAL_EFFECTIVE_LABEL = 'Hatályos: 2026. augusztus 26.'

/**
 * A mandatory value nobody has supplied yet.
 *
 * A symbol rather than `null` or `''`: those are values a careless template
 * would happily interpolate into a sentence, and an empty seat address reads
 * as no seat rather than as a defect. Every render path has to go through
 * `legalText()`, which cannot be given a symbol by accident.
 */
export const MISSING = Symbol.for('ourfilm.legal.missing')
export type Missing = typeof MISSING

/** A legal fact, or the fact that nobody has supplied it. */
export type LegalValue = string | Missing

/** What a page shows in place of a value that is not there. */
export const MISSING_LABEL = 'HIÁNYZÓ KÖTELEZŐ ADAT'

export function isMissing(value: LegalValue): value is Missing {
  return value === MISSING
}

/** The only way a legal value reaches the DOM. */
export function legalText(value: LegalValue): string {
  return isMissing(value) ? MISSING_LABEL : value
}

export type Subprocessor = {
  name: string
  /** What it does, phrased for a data subject rather than for an architect. */
  purpose: string
  /** Where the processing happens. */
  location: string
  /**
   * The safeguard relied on for a transfer outside the EEA.
   *
   * `undefined` means the processing stays inside the EEA and no safeguard is
   * needed. `MISSING` means it does leave and nobody has confirmed which
   * safeguard the actual agreement relies on — which is a blocker, because
   * naming the wrong one is a false statement in a privacy notice.
   */
  transferBasis?: LegalValue
}

export type LegalConfig = {
  legalVersion: LegalVersion
  effectiveDate: string
  provider: {
    displayName: string
    legalName: LegalValue
    legalForm: LegalValue
    registeredSeat: LegalValue
    mailingAddress: LegalValue
    registrationNumber: LegalValue
    taxNumber: LegalValue
    statisticalNumber?: LegalValue
    registryAuthority: LegalValue
    email: LegalValue
    phone?: LegalValue
  }
  hostingProvider: {
    name: LegalValue
    registeredSeat: LegalValue
    email: LegalValue
  }
  supervisoryAuthority: {
    name: LegalValue
    seat: LegalValue
    mailingAddress: LegalValue
    website: LegalValue
    phone: LegalValue
  }
  consumerProtectionAuthority: {
    name: LegalValue
    website: LegalValue
  }
  conciliationBody: {
    name: LegalValue
    seat: LegalValue
    website: LegalValue
    email: LegalValue
  }
  service: {
    priceHuf: number
    activeAlbumMonths: 6
    deletionWarningDays: 30
    /** Only set once a provider agreement actually states a backup cycle. Left
     *  undefined, the ÁSZF simply does not make a claim about backups. */
    backupDeletionDays?: number
    /** How long request and security logs are kept. Undefined until the actual
     *  Vercel and Supabase retention settings have been read off the consoles. */
    securityLogRetentionDays?: number
    shotLimitOptions: readonly [5, 10, 16, 24, 36]
  }
  subprocessors: Subprocessor[]
}

export const legalConfig: LegalConfig = {
  legalVersion: LEGAL_VERSION,
  effectiveDate: LEGAL_VERSION,

  provider: {
    // The product name, which is not a legal identifier and never stands in
    // for one.
    displayName: 'OurFilm',
    legalName: MISSING,
    // The provider is a sole trader (egyéni vállalkozó), which is
    // why there is a nyilvántartási szám below and no cégjegyzékszám.
    legalForm: 'egyéni vállalkozó',
    registeredSeat: MISSING,
    mailingAddress: MISSING,
    registrationNumber: MISSING,
    taxNumber: MISSING,
    // An EV appears in an administrative register, not a company court's.
    registryAuthority: 'Egyéni Vállalkozók Nyilvántartása (EVNY)',
    email: CONTACT_EMAIL,
    phone: MISSING,
  },

  hostingProvider: {
    // vercel.json pins the functions and the deployment is Vercel's; the
    // address is the one this project has always published.
    name: 'Vercel Inc.',
    registeredSeat:
      '340 S Lemon Ave #4133, Walnut, CA 91789, Amerikai Egyesült Államok',
    email: MISSING,
  },

  // Filled in from the authority's own published details before launch. Left
  // missing rather than typed from memory: an impresszum that sends a
  // complaint to the wrong postal address is worse than one that visibly has
  // a gap.
  supervisoryAuthority: {
    name: MISSING,
    seat: MISSING,
    mailingAddress: MISSING,
    website: MISSING,
    phone: MISSING,
  },

  consumerProtectionAuthority: {
    name: MISSING,
    website: MISSING,
  },

  // Which testület is competent follows from the provider's seat, so this
  // cannot be filled in before `registeredSeat` is.
  conciliationBody: {
    name: MISSING,
    seat: MISSING,
    website: MISSING,
    email: MISSING,
  },

  service: {
    // Mirrors the Stripe Price behind STRIPE_PRICE_EVENT (1290000 minor
    // units) and EVENT_PRICE_LABEL. Three copies of one number is two too
    // many; `lib/pricing.ts` now derives its label from here.
    priceHuf: 12_900,
    activeAlbumMonths: 6,
    deletionWarningDays: 30,
    // No backup cycle is claimed until Supabase's actual PITR/backup window
    // for this project has been read off the dashboard.
    backupDeletionDays: undefined,
    securityLogRetentionDays: undefined,
    shotLimitOptions: [5, 10, 16, 24, 36],
  },

  subprocessors: [
    {
      name: 'Supabase',
      purpose: 'Adatbázis, fájltárolás és hitelesítés',
      location: 'Svájc (eu-central-2, Zürich)',
      // Switzerland is covered by a European Commission adequacy decision, so
      // the transfer needs no contractual safeguard of its own. This is a
      // matter of law rather than of what the agreement says, which is why it
      // is the one transfer stated here.
      transferBasis:
        'Az Európai Bizottság Svájcra vonatkozó megfelelőségi határozata',
    },
    {
      name: 'Vercel Inc.',
      purpose: 'A weboldal és a szerveroldali funkciók kiszolgálása',
      location:
        'Amerikai Egyesült Államok (a futtatás régiója: fra1, Frankfurt)',
      transferBasis: MISSING,
    },
    {
      name: 'Stripe Payments Europe, Limited',
      purpose: 'Bankkártyás fizetés feldolgozása',
      location: 'Írország (Európai Gazdasági Térség)',
      // Inside the EEA: nothing to state.
      transferBasis: undefined,
    },
    {
      name: 'Resend',
      purpose: 'A belépési és értesítő e-mailek kézbesítése',
      location: 'Amerikai Egyesült Államok',
      transferBasis: MISSING,
    },
  ],
}

/** Every price the product quotes, formatted the one way it is written. */
export function formatHuf(amount: number): string {
  // Non-breaking thin space between the groups and before Ft, which is how a
  // Hungarian price is set and what keeps "12 900 Ft" from wrapping.
  return `${new Intl.NumberFormat('hu-HU').format(amount)} Ft`
}

export type LegalBlocker = {
  /** Dotted path into the config, so a reader knows exactly what to fill in. */
  path: string
  /** Why publication cannot proceed without it. */
  reason: string
}

/**
 * Everything still missing, as a list a human can work through.
 *
 * Read by `hasCompleteLegalConfig()` below, by the draft banner on the legal
 * pages, and by a unit test that fails if a page would render a token.
 */
export function legalBlockers(
  config: LegalConfig = legalConfig,
): LegalBlocker[] {
  const blockers: LegalBlocker[] = []

  const require = (
    path: string,
    value: LegalValue | undefined,
    reason: string,
  ) => {
    if (value === undefined || isMissing(value)) blockers.push({ path, reason })
  }

  require('provider.legalName', config.provider
    .legalName, 'Az impresszum és az ÁSZF kötelező eleme (Elker tv. 4. §).')
  require('provider.registeredSeat', config.provider
    .registeredSeat, 'Kötelező azonosító adat; ebből következik az illetékes békéltető testület is.')
  require('provider.mailingAddress', config.provider
    .mailingAddress, 'A panasz és az elállási nyilatkozat postai címe.')
  require('provider.registrationNumber', config.provider
    .registrationNumber, 'Nyilvántartási szám az EVNY-ből.')
  require('provider.taxNumber', config.provider
    .taxNumber, 'Adószám; a számlázás és az alanyi adómentesség állítása is ezen múlik.')
  require('provider.phone', config.provider
    .phone, 'A 45/2014. (II. 26.) Korm. rendelet 11. §-a szerint telefonszám is kell, e-mail-cím önmagában nem elég.')
  require('hostingProvider.email', config.hostingProvider
    .email, 'A tárhelyszolgáltató elérhetősége az Elker tv. szerint kötelező.')
  require('supervisoryAuthority.name', config.supervisoryAuthority
    .name, 'A felügyeleti hatóság megnevezése az adatkezelési tájékoztató kötelező eleme.')
  require('supervisoryAuthority.seat', config.supervisoryAuthority
    .seat, 'A felügyeleti hatóság székhelye.')
  require('supervisoryAuthority.mailingAddress', config.supervisoryAuthority
    .mailingAddress, 'A felügyeleti hatóság levelezési címe.')
  require('supervisoryAuthority.website', config.supervisoryAuthority
    .website, 'A felügyeleti hatóság weboldala.')
  require('supervisoryAuthority.phone', config.supervisoryAuthority
    .phone, 'A felügyeleti hatóság telefonszáma.')
  require('consumerProtectionAuthority.name', config.consumerProtectionAuthority
    .name, 'Fogyasztóvédelmi jogorvoslati tájékoztatás.')
  require('consumerProtectionAuthority.website', config
    .consumerProtectionAuthority
    .website, 'Fogyasztóvédelmi jogorvoslati tájékoztatás.')
  require('conciliationBody.name', config.conciliationBody
    .name, 'A székhely szerint illetékes békéltető testület megnevezése.')
  require('conciliationBody.seat', config.conciliationBody
    .seat, 'A békéltető testület címe.')
  require('conciliationBody.website', config.conciliationBody
    .website, 'A békéltető testület weboldala.')
  require('conciliationBody.email', config.conciliationBody
    .email, 'A békéltető testület e-mail-címe.')

  if (config.service.securityLogRetentionDays === undefined) {
    blockers.push({
      path: 'service.securityLogRetentionDays',
      reason:
        'Az adatkezelési tájékoztató naplómegőrzési ideje. A Vercel és a Supabase tényleges naplóbeállításából kell kiolvasni.',
    })
  }

  for (const [i, sub] of config.subprocessors.entries()) {
    if (sub.transferBasis !== undefined && isMissing(sub.transferBasis)) {
      blockers.push({
        path: `subprocessors[${i}].transferBasis (${sub.name})`,
        reason:
          'EGT-n kívüli adatkezelés igazolt továbbítási garancia nélkül. A tényleges szerződésből kell megállapítani; addig nem állítható róla semmi.',
      })
    }
  }

  return blockers
}

/**
 * Whether the legal pages may be indexed and offered as a real commitment.
 *
 * Replaces `hasRealCompanyDetails`, which asked a narrower version of the same
 * question against a smaller set of facts.
 */
export function hasCompleteLegalConfig(
  config: LegalConfig = legalConfig,
): boolean {
  return legalBlockers(config).length === 0
}
