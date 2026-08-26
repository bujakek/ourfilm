/**
 * How long an album stays, expressed as pure functions of `now`.
 *
 * Same discipline as `lib/camera.ts`: nothing here reads a clock. The host's
 * settings page renders these to say what will happen, the retention run
 * evaluates them to decide what to do, and the ÁSZF states them in Hungarian —
 * three readers of one rule, which is exactly the shape that goes wrong when
 * the rule is written down three times.
 *
 * The rule: the album is actively available for **6 months** after the event
 * ends; the host is warned; a further **30 days** of grace follow, during
 * which everything still works and the content can still be downloaded; after
 * that the event is permanently deleted from the active systems.
 *
 * **The grace period is not a restriction.** During it the album behaves
 * exactly as before — the point of a grace period is that the host can still
 * get their photographs out, and locking it would defeat the notice that told
 * them to.
 */

import { legalConfig } from './legal/config'

export const ACTIVE_MONTHS = legalConfig.service.activeAlbumMonths
export const GRACE_DAYS = legalConfig.service.deletionWarningDays

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Calendar months, matching Postgres's `interval '6 months'` rather than
 * counting 180 days.
 *
 * The database is the authority here — `events_due_for_deletion()` uses the
 * interval — so this mirrors it: same calendar arithmetic, same clamping when
 * the source day does not exist in the target month (31 August + 6 months is
 * 28 or 29 February, not 3 March).
 */
export function addMonthsUtc(date: Date, months: number): Date {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + months
  const day = date.getUTCDate()

  const candidate = new Date(
    Date.UTC(
      year,
      month,
      1,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  )
  const lastDay = new Date(
    Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth() + 1, 0),
  ).getUTCDate()

  candidate.setUTCDate(Math.min(day, lastDay))
  return candidate
}

export type RetentionDates = {
  /** When the active period ends and the grace period begins. */
  activeUntil: Date
  /** When the event becomes eligible for permanent deletion. */
  deleteAfter: Date
}

export function retentionDates(captureEndAt: Date): RetentionDates {
  const activeUntil = addMonthsUtc(captureEndAt, ACTIVE_MONTHS)
  return {
    activeUntil,
    deleteAfter: new Date(activeUntil.getTime() + GRACE_DAYS * DAY_MS),
  }
}

export type RetentionState =
  /** Inside the 6-month window. Nothing to say beyond the date. */
  | 'active'
  /** Past 6 months, inside the 30-day grace period. Download now. */
  | 'grace'
  /** Past the grace period. The next retention run deletes it. */
  | 'due'
  /** Automatic deletion is suspended by a legal hold. */
  | 'hold'

export function retentionState({
  now,
  captureEndAt,
  legalHoldAt = null,
}: {
  now: Date
  captureEndAt: Date
  legalHoldAt?: Date | null
}): RetentionState {
  if (legalHoldAt) return 'hold'

  const { activeUntil, deleteAfter } = retentionDates(captureEndAt)
  if (now < activeUntil) return 'active'
  if (now < deleteAfter) return 'grace'
  return 'due'
}
