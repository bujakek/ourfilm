/**
 * The disposable camera's rules, as pure functions.
 *
 * Isomorphic on purpose — the server computes these to decide what is allowed
 * and the client computes them to decide what to draw, and the two must never
 * disagree. Nothing here reads a clock of its own: every function takes `now`,
 * which is what makes them testable and what stops a client's wrong system
 * clock from being an argument about permissions.
 *
 * The database is still the enforcement. `reserve_shot` re-derives the capture
 * window and the shot count inside a locked transaction; these functions decide
 * what a screen says, not what a guest gets.
 */

/** The roll lengths a host may choose. Mirrors the check constraint on
 *  `events.shots_per_participant` — a value not in this list is refused by
 *  Postgres, so the form and the column cannot drift. */
export const SHOT_OPTIONS = [5, 10, 16, 24, 36] as const

export type ShotOption = (typeof SHOT_OPTIONS)[number]

/** What the create form pre-selects and labels "Ajánlott". Long enough that a
 *  guest shoots without rationing, short enough to still feel like film. */
export const DEFAULT_SHOTS: ShotOption = 24

export function isShotOption(value: unknown): value is ShotOption {
  return SHOT_OPTIONS.includes(value as ShotOption)
}

export type RevealMode = 'instant' | 'event_end' | 'custom'

export const REVEAL_MODES: readonly RevealMode[] = [
  'instant',
  'event_end',
  'custom',
]

/** The two reveal rules a host can currently choose. `custom` stays in the
 * database model for backwards compatibility, but is not a product setting. */
export const REVEAL_CHOICES = ['instant', 'event_end'] as const

export type RevealChoice = (typeof REVEAL_CHOICES)[number]

export function isRevealMode(value: unknown): value is RevealMode {
  return REVEAL_MODES.includes(value as RevealMode)
}

export function isRevealChoice(value: unknown): value is RevealChoice {
  return REVEAL_CHOICES.includes(value as RevealChoice)
}

/**
 * Resolve the moment the gallery opens.
 *
 * Mirrors `public.events_resolve_reveal_at()`, the trigger that materialises
 * this column on every write. Duplicated here so the create wizard can show a
 * host the actual date before the row exists — and kept as one expression in
 * both places so there is exactly one rule to check against.
 */
export function resolveRevealAt({
  mode,
  captureStartAt,
  captureEndAt,
  customRevealAt,
}: {
  mode: RevealMode
  captureStartAt: Date
  captureEndAt: Date
  customRevealAt: Date | null
}): Date {
  if (mode === 'instant') return captureStartAt
  if (mode === 'event_end') return captureEndAt
  return customRevealAt ?? captureEndAt
}

export type CaptureWindowState = 'before' | 'open' | 'after'

export function captureWindowState({
  now,
  captureStartAt,
  captureEndAt,
}: {
  now: Date
  captureStartAt: Date
  captureEndAt: Date
}): CaptureWindowState {
  if (now < captureStartAt) return 'before'
  if (now > captureEndAt) return 'after'
  return 'open'
}

/**
 * Whether guests may browse the album.
 *
 * Two conditions, and both are the host's: the reveal has arrived, and the host
 * left guest access switched on. A host who turns guests off keeps their own
 * access — that read never comes through here, it goes through `/host` under
 * ownership RLS.
 */
export function guestGalleryIsOpen({
  now,
  revealAt,
  guestsCanView,
}: {
  now: Date
  revealAt: Date
  guestsCanView: boolean
}): boolean {
  return guestsCanView && now >= revealAt
}

export type EventValidationError =
  'name_required' | 'window_backwards' | 'reveal_before_end' | 'invalid_shots'

/**
 * Everything the create wizard and the settings page both have to refuse.
 *
 * Returns every problem rather than the first, because the wizard renders them
 * against the step each belongs to and a one-at-a-time API would send a host
 * back and forth.
 */
export function validateEventDraft({
  name,
  captureStartAt,
  captureEndAt,
  revealMode,
  customRevealAt,
  shotsPerParticipant,
}: {
  name: string
  captureStartAt: Date | null
  captureEndAt: Date | null
  revealMode: RevealMode
  customRevealAt: Date | null
  shotsPerParticipant: number
}): EventValidationError[] {
  const errors: EventValidationError[] = []

  if (!name.trim()) errors.push('name_required')

  if (
    captureStartAt &&
    captureEndAt &&
    captureEndAt.getTime() <= captureStartAt.getTime()
  ) {
    errors.push('window_backwards')
  }

  // Only the custom mode can be wrong here: the other two are pinned to the
  // window itself, so they cannot precede it by construction.
  if (
    revealMode === 'custom' &&
    captureEndAt &&
    (!customRevealAt || customRevealAt.getTime() < captureEndAt.getTime())
  ) {
    errors.push('reveal_before_end')
  }

  if (!isShotOption(shotsPerParticipant)) errors.push('invalid_shots')

  return errors
}
