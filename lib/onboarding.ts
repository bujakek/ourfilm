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
 * `app/host/events/new/page.tsx`). So every caller passes null for now, and
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
