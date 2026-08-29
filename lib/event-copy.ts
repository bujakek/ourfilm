import { captureWindowState, guestGalleryIsOpen } from './camera'
import { formatDeadline } from './format'
import type { Locale } from './i18n'

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
      return 'Véget ért a fotózás'
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
      return null
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
  locale: Locale = 'hu',
): string {
  const state = captureWindowState(timing)
  if (state === 'before') {
    const deadline = formatDeadline(
      timing.captureStartAt.toISOString(),
      timing.timeZone,
      locale,
    )
    return locale === 'en'
      ? `Shooting starts ${deadline}. You can join now.`
      : `A fotózás ${deadline}-kor kezdődik. Addig is csatlakozhatsz.`
  }
  if (state === 'after') {
    return locale === 'en' ? 'Shooting has ended.' : 'A fotózás véget ért.'
  }
  return locale === 'en'
    ? `The camera is open — you have ${shotsPerParticipant} shots.`
    : `Most lehet fotózni — ${shotsPerParticipant} kép a tiéd.`
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
export function galleryLock(
  timing: EventTiming,
  locale: Locale = 'hu',
): GalleryLock {
  if (guestGalleryIsOpen(timing)) return { open: true }

  if (!timing.guestsCanView) {
    return {
      open: false,
      heading:
        locale === 'en'
          ? 'Only the host can see these photos'
          : 'A képeket csak a szervező láthatja',
      detail: null,
    }
  }

  return {
    open: false,
    heading:
      locale === 'en'
        ? 'The photos are still developing'
        : 'A képek még előhívás alatt vannak',
    detail: `${locale === 'en' ? 'The gallery opens' : 'A galéria'} ${formatDeadline(
      timing.revealAt.toISOString(),
      timing.timeZone,
      locale,
    )}${locale === 'en' ? '.' : ' nyílik meg.'}`,
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
