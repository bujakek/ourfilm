/**
 * The create flow's own rules, as pure functions.
 *
 * `lib/camera.ts` holds what the *event* is allowed to be — the shot options,
 * reveal rules and shared validation. What lives here is narrower: the handful
 * of decisions that exist only while a host is answering four questions and no
 * row exists yet.
 *
 * Same discipline as `camera.ts`: nothing reads a clock of its own, so the
 * server can re-derive every one of these from the FormData it is handed.
 */

import { formatEventLocalInput } from '@/lib/format'
import type { Locale } from '@/lib/i18n'

/**
 * The three titles offered under the name field on the first screen.
 *
 * They are prompts, not event types: tapping one fills the field with something
 * a host would plausibly keep, and the point is removing the blank-field pause
 * rather than classifying the party. Three rather than five, so the chips fit
 * two rows at 390px and 130% text.
 *
 * The birthday is personalised when the host's first name is known. Today it
 * never is — a magic-link signup carries only an email, and reading the account
 * on the create page would make that segment suspend into the admin loading
 * boundary, which is a hydration bug rather than a nicety (see the note on
 * `app/(product)/host/events/new/page.tsx`). So every caller passes null for
 * now, and the generic titles are what a host actually sees.
 */
export function eventNameSuggestions(
  firstName: string | null,
  locale: Locale = 'hu',
): string[] {
  const name = firstName?.trim()
  if (locale === 'en') {
    return [
      'Our wedding',
      name ? `${name}’s birthday` : 'Birthday party',
      'An unforgettable night',
    ]
  }
  return [
    'Esküvőnk',
    name ? `${name} szülinapja` : 'Szülinapi buli',
    'Egy felejthetetlen este',
  ]
}

/** The two dated chips on the end screen. "Másik nap" is the third, and is
 *  whatever these two are not. */
export type EndQuickPick = 'tonight' | 'tomorrow'

/** Before this hour a time belongs to the night that started the day before:
 *  "Ma éjjel 02:00" is after midnight, not fourteen hours ago. */
const NIGHT_ROLLOVER_HOUR = 12

/** A bare `YYYY-MM-DD` moved by whole days. Calendar arithmetic in UTC, where
 *  no day is 23 or 25 hours long — the zone was settled when the day was read. */
function addDays(day: string, days: number): string {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date + days))
    .toISOString()
    .slice(0, 10)
}

/**
 * The end a quick pick stands for, as a `datetime-local` value in the event's
 * zone.
 *
 * "Tonight" is the night that starts today where the host is standing: a time
 * of 12:00 or later lands on today's date, an earlier one on tomorrow's.
 * "Tomorrow" is the same, one day later. Takes `now` like everything here.
 */
export function endQuickPick(
  kind: EndQuickPick,
  time: string,
  now: Date,
  timeZone: string,
): string {
  const today = formatEventLocalInput(now, timeZone).slice(0, 10)
  const hour = Number(time.slice(0, 2))
  const tonight = hour >= NIGHT_ROLLOVER_HOUR ? today : addDays(today, 1)
  return `${kind === 'tonight' ? tonight : addDays(tonight, 1)}T${time}`
}

/** Which chip an end reads as: the inverse of `endQuickPick` at the end's own
 *  time, so the chips and the day tile can never disagree. */
export function activeQuickPick(
  endLocal: string,
  now: Date,
  timeZone: string,
): EndQuickPick | 'other' {
  const time = endLocal.slice(11, 16)
  if (!/^\d{2}:\d{2}$/.test(time)) return 'other'
  for (const kind of ['tonight', 'tomorrow'] as const) {
    if (endQuickPick(kind, time, now, timeZone) === endLocal) return kind
  }
  return 'other'
}

/** Where the end's day came from: a quick pick, or the month. */
export type EndDaySource = 'chip' | 'calendar'

/**
 * The end after its time is edited. "Ma éjjel" at 02:00 is after midnight, so
 * while a quick pick is what the host chose, a new time keeps meaning that
 * pick and the day follows it. A day picked from the month stays put, even
 * when it happens to be tonight's or tomorrow's date.
 */
export function endAfterTimeEdit(
  endLocal: string,
  time: string,
  source: EndDaySource,
  now: Date,
  timeZone: string,
): string {
  const picked =
    source === 'chip' ? activeQuickPick(endLocal, now, timeZone) : 'other'
  return picked === 'other'
    ? `${endLocal.slice(0, 10)}T${time}`
    : endQuickPick(picked, time, now, timeZone)
}

/**
 * Which tier the host picks on the last screen.
 *
 * Not a column. The free tier is a participant cap enforced inside
 * `join_event`, and `full` is lifted by a paid `purchases` row — so this
 * only decides where the host lands after the event is created: on their new
 * event, or on Stripe. An abandoned checkout leaves an ordinary free event,
 * which is exactly what the ledger already models with a `pending` row.
 */
export type EventPlan = 'free' | 'full'

export function isEventPlan(value: unknown): value is EventPlan {
  return value === 'free' || value === 'full'
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
