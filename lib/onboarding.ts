/**
 * The create flow's own rules, as pure functions.
 *
 * `lib/camera.ts` holds what the *event* is allowed to be — the shot options,
 * the reveal resolution, the validation both the wizard and the settings page
 * run. What lives here is narrower: the handful of decisions that exist only
 * while a host is answering four questions and no row exists yet.
 *
 * Same discipline as `camera.ts`: nothing reads a clock of its own, so the
 * server can re-derive every one of these from the FormData it is handed.
 */

/**
 * The delayed reveal is counted in **days**, not hours.
 *
 * A host choosing "later" is choosing a morning-after or a next-weekend, and
 * both of those are days. An hours stepper would need eighteen taps to express
 * the common answer.
 */
export const MIN_REVEAL_DELAY_DAYS = 1
export const MAX_REVEAL_DELAY_DAYS = 30
export const DEFAULT_REVEAL_DELAY_DAYS = 1

const DAY_MS = 24 * 60 * 60 * 1000

/** The value arrives from a stepper the host can hold down and from a FormData
 *  anyone can post, so it is clamped rather than trusted. Non-numbers fall back
 *  to the default instead of poisoning the arithmetic with NaN. */
export function clampRevealDelayDays(value: unknown): number {
  const days = Math.trunc(Number(value))
  if (!Number.isFinite(days)) return DEFAULT_REVEAL_DELAY_DAYS
  return Math.min(MAX_REVEAL_DELAY_DAYS, Math.max(MIN_REVEAL_DELAY_DAYS, days))
}

/**
 * When a delayed album opens: the capture window's end plus whole days.
 *
 * Plain milliseconds rather than calendar arithmetic, deliberately. "Two days
 * later" here means 48 hours later, and across a DST boundary those two answers
 * differ by an hour — the wall clock one would move the reveal an hour earlier
 * or later than the badge the host was shown while choosing it.
 */
export function revealAfterDelay(captureEndAt: Date, days: number): Date {
  return new Date(captureEndAt.getTime() + clampRevealDelayDays(days) * DAY_MS)
}

/** `1 nap`, `15 nap`. Hungarian counts with the singular after a number, so
 *  there is no plural to branch on — the function exists so no caller is
 *  tempted to invent one. */
export function formatDelayDays(days: number): string {
  return `${clampRevealDelayDays(days)} nap`
}

/**
 * The five titles offered under ÖTLETEK on the first screen.
 *
 * They are prompts, not event types: tapping one fills the field with something
 * a host would plausibly keep, and the point is removing the blank-field pause
 * rather than classifying the party.
 *
 * Two of them are personalised when the host's first name is known. Today it
 * never is — a magic-link signup carries only an email, and reading the account
 * on the create page would make that segment suspend into the admin loading
 * boundary, which is a hydration bug rather than a nicety (see the note on
 * `app/admin/events/new/page.tsx`). So every caller passes null for now, and
 * the generic pair is what a host actually sees.
 */
export function eventNameSuggestions(firstName: string | null): string[] {
  const name = firstName?.trim()
  const opening = name
    ? [`${name} bulija`, `${name} születésnapja`]
    : ['A nagy bulink', 'Születésnapi buli']
  return [...opening, 'Az esküvőnk', 'Az évfordulónk', 'A mi kis bulink']
}

/**
 * Which tier the host picks on the last screen.
 *
 * Not a column. The free tier is a participant cap enforced inside
 * `join_event`, and `unlimited` is lifted by a paid `purchases` row — so this
 * only decides where the host lands after the event is created: on their new
 * event, or on Stripe. An abandoned checkout leaves an ordinary free event,
 * which is exactly what the ledger already models with a `pending` row.
 */
export type EventPlan = 'free' | 'unlimited'

export function isEventPlan(value: unknown): value is EventPlan {
  return value === 'free' || value === 'unlimited'
}

/**
 * The number the last screen prints next to "Legfeljebb".
 *
 * Mirrors `public.free_participant_limit()`, which is the one that actually
 * turns a sixth guest away. Duplicated here so the screen can name the limit
 * before the event exists — and kept as a bare constant so the day the database
 * function changes, the grep for it lands on this line.
 */
export const FREE_PARTICIPANT_LIMIT = 5
