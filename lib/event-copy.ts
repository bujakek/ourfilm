import { captureWindowState, guestGalleryIsOpen } from './camera'
import { formatDeadline } from './format'
import { CAMERA_COPY } from './legal/copy/forms'

/**
 * The Hungarian a guest reads about an event's state.
 *
 * One module so the join screen, the camera and the gallery cannot describe the
 * same event differently — three screens saying three things about whether the
 * camera is open is the specific failure this exists to prevent.
 *
 * Isomorphic and clock-free: every function takes `now`. The server renders
 * these, and a helper that read its own clock would be untestable and would
 * quietly disagree with the permission booleans computed in Postgres.
 */

export type EventTiming = {
  now: Date
  captureStartAt: Date
  captureEndAt: Date
  revealAt: Date
  guestsCanView: boolean
  timeZone: string
}

/** Headline for the capture window's current state, or null while it is open —
 *  an open camera needs no announcement. */
export function captureStateHeading(timing: EventTiming): string | null {
  switch (captureWindowState(timing)) {
    case 'before':
      return 'A kamera még nem nyílt meg'
    case 'after':
      // The approved wording, shared with the camera's own copy so the closed
      // camera and the closed-window screen cannot say two different things.
      return CAMERA_COPY.closedHeading
    default:
      return null
  }
}

/** The supporting line under `captureStateHeading`. */
export function captureStateDetail(timing: EventTiming): string | null {
  switch (captureWindowState(timing)) {
    case 'before':
      return `A fotózás kezdete: ${formatDeadline(
        timing.captureStartAt.toISOString(),
        timing.timeZone,
      )}`
    case 'after':
      // Whether they can look at anything is the gallery's question, answered
      // separately below — the camera closing and the album opening are two
      // different permissions and the copy keeps them apart.
      return CAMERA_COPY.closedBody
    default:
      return `Fotózhatsz ${formatDeadline(
        timing.captureEndAt.toISOString(),
        timing.timeZone,
      )}-ig`
  }
}

/** One line summarising the event for the join screen. */
export function joinStateLabel(
  timing: EventTiming,
  shotsPerParticipant: number,
): string {
  const state = captureWindowState(timing)
  if (state === 'before') {
    return `A fotózás ${formatDeadline(
      timing.captureStartAt.toISOString(),
      timing.timeZone,
    )}-kor kezdődik. Addig is csatlakozhatsz.`
  }
  if (state === 'after') {
    return `${CAMERA_COPY.closedHeading}.`
  }
  return `Most lehet fotózni — ${shotsPerParticipant} kép a tiéd.`
}

export type GalleryLock =
  { open: true } | { open: false; heading: string; detail: string | null }

/**
 * Why a guest cannot see the album, phrased for them.
 *
 * The two closed cases are genuinely different and must not collapse into one
 * message: "still developing" is a wait, and "only the organizer" is a decision
 * the host made. Telling a guest to wait for something that will never open
 * would be a small lie that a guest discovers by refreshing all evening.
 */
export function galleryLock(timing: EventTiming): GalleryLock {
  if (guestGalleryIsOpen(timing)) return { open: true }

  if (!timing.guestsCanView) {
    return {
      open: false,
      heading: 'A képeket csak a szervező láthatja',
      detail: null,
    }
  }

  return {
    open: false,
    heading: 'A képek még előhívás alatt vannak',
    detail: `A galéria ${formatDeadline(
      timing.revealAt.toISOString(),
      timing.timeZone,
    )} nyílik meg.`,
  }
}

/** The reveal moment as a bare date, for sentences that supply their own frame
 *  ("A galéria {x} nyílik meg."). Null when guests will never see it. */
export function revealLabel(timing: EventTiming): string | null {
  if (!timing.guestsCanView) return null
  return formatDeadline(timing.revealAt.toISOString(), timing.timeZone)
}

/** How the host's own screens name the reveal rule. */
export function revealModeLabel(
  mode: 'instant' | 'event_end' | 'custom',
): string {
  switch (mode) {
    case 'instant':
      return 'Azonnal'
    case 'event_end':
      return 'Az esemény végén'
    default:
      return 'Később'
  }
}

/** The line the camera prints under the shot counter.
 *
 *  Two answers, not one: an album that will open at a moment, and an album
 *  guests will never see. Collapsing them would tell someone to wait for a
 *  gallery that is never coming. */
export function revealHelperLine(timing: EventTiming): string {
  const label = revealLabel(timing)
  return label
    ? CAMERA_COPY.revealHelper(label)
    : 'A képeket csak a szervező láthatja'
}
