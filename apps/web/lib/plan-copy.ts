import type { Locale } from './i18n'

/**
 * Why an event has no participant cap.
 *
 * Mirrors what `public.event_plan_source()` returns — `early_couple` and
 * `operator` are the `event_grants.reason` values, surfaced rather than
 * flattened to "granted" so the two cannot end up sharing copy. The database
 * is the authority; this type only narrows the `text` it returns so a screen
 * cannot branch on a reason that does not exist.
 */
export type PlanSource = 'paid' | 'early_couple' | 'operator' | 'admin'

const PLAN_SOURCES: readonly string[] = [
  'paid',
  'early_couple',
  'operator',
  'admin',
]

/** Narrows what the RPC returned, treating anything unrecognised as "capped". */
export function toPlanSource(value: string | null): PlanSource | null {
  return value !== null && PLAN_SOURCES.includes(value)
    ? (value as PlanSource)
    : null
}

/**
 * The line the host reads under "Teljes esemény", or null to fall back to the
 * card's own generic copy.
 *
 * Separated from the card so the four reasons cannot drift into describing
 * each other. The specific thing this prevents: an Early Couple Program event
 * reading "Kifizetve — 12 900 Ft". Nobody paid, there is no receipt to show,
 * and the one screen a host checks to confirm what they were charged is the
 * worst place to invent one.
 *
 * `receipt` is the formatted amount and date of a settled payment, and is only
 * ever used by the `paid` branch.
 */
export function planNote(
  source: PlanSource | null,
  locale: Locale,
  receipt: string | null,
): string | null {
  const en = locale === 'en'

  switch (source) {
    case 'paid':
      // No receipt means the payment settled but the ledger row is not
      // readable — say nothing rather than assert an amount.
      return receipt ? `${en ? 'Paid' : 'Kifizetve'} — ${receipt}` : null
    case 'early_couple':
      return en
        ? 'Early Couple Program — unlimited guests, with our thanks.'
        : 'Early Couple Program — korlátlan résztvevő, köszönjük nektek.'
    case 'operator':
      return en
        ? 'Unlocked by the OurFilm team — unlimited guests.'
        : 'Az OurFilm csapata feloldotta — korlátlan résztvevő.'
    // An admin-owned event is uncapped because of the account, not the event,
    // and the card already says exactly that.
    case 'admin':
    default:
      return null
  }
}
