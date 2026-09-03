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

/**
 * The camera's own line at the reveal-locked gallery.
 *
 * Needed because the guest surface now shows two things that obey different
 * rules on one screen: the strip above holds this guest's own frames, which are
 * never reveal-gated, and the gallery below holds everybody's, which is. A
 * guest looking at their own photos over a locked album would otherwise read
 * the lock as a bug.
 */
export function ownRollNote(locale: Locale = 'hu'): string {
  return locale === 'en'
    ? 'The frames on your roll are already yours — only the shared gallery waits for developing.'
    : 'A tekercseden lévő képek már a tieid — csak a közös galéria vár az előhívásra.'
}

/**
 * `6Ó 20P` — how long the camera stays open, in as few characters as possible.
 *
 * A second, shorter spelling of the same number the join screen states in a
 * sentence, because the status row sets it in wide mono caps where
 * "6 óra 20 perc van hátra" is three lines. Two units at most: a guest reading
 * a countdown does not need minutes when there are days left.
 */
export function shortTimeRemaining(
  captureEndAt: Date,
  now: Date,
  locale: Locale = 'hu',
): string {
  const en = locale === 'en'
  const totalMinutes = Math.max(
    0,
    Math.ceil((captureEndAt.getTime() - now.getTime()) / 60_000),
  )

  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60

  const [d, h, m] = en ? ['D', 'H', 'M'] : ['N', 'Ó', 'P']

  if (days > 0) return hours > 0 ? `${days}${d} ${hours}${h}` : `${days}${d}`
  if (hours > 0)
    return minutes > 0 ? `${hours}${h} ${minutes}${m}` : `${hours}${h}`
  return `${minutes}${m}`
}

export type CaptureStatus = {
  /** Whether the camera is open — the one thing lilac is now allowed to mean. */
  live: boolean
  label: string
}

/**
 * The status row's right-hand pill: a dot and four to nine mono characters.
 *
 * Uppercase because it is set in Martian Mono at 9.5px, where the point is that
 * it reads as a readout rather than as a sentence.
 */
export function captureStatus(
  timing: EventTiming,
  locale: Locale = 'hu',
): CaptureStatus {
  const en = locale === 'en'
  switch (captureWindowState(timing)) {
    case 'before':
      return { live: false, label: en ? 'NOT OPEN YET' : 'MÉG ZÁRVA' }
    case 'after':
      return { live: false, label: en ? 'CLOSED' : 'LEZÁRULT' }
    default:
      return {
        live: true,
        label: `${en ? 'LIVE' : 'NYITVA'} · ${shortTimeRemaining(
          timing.captureEndAt,
          timing.now,
          locale,
        )}`,
      }
  }
}

/**
 * The format, stated rather than implied.
 *
 * This is where "no preview, no retakes" finally appears on the guest's own
 * screen — it was a landing-page claim and a thing the product did, and never a
 * sentence the person holding the camera actually read. The guest count rides
 * along because it is the third value the deleted `<dl>` carried and it belongs
 * next to the other two facts about the format rather than in a list of its
 * own.
 */
export function formatLine(
  participantCount: number,
  locale: Locale = 'hu',
): string {
  const en = locale === 'en'
  const guests = en
    ? `${participantCount} ${participantCount === 1 ? 'GUEST' : 'GUESTS'}`
    : `${participantCount} VENDÉG`
  return en
    ? `${guests} · NO PREVIEW · NO RETAKES`
    : `${guests} · NINCS ELŐNÉZET · NINCS ÚJRAPRÓBÁLÁS`
}

/** How the guest's ticket names the reveal rule, in mono caps. The host's own
 *  screens use `revealModeLabel` below, which is sentence case and Hungarian
 *  only — a host and a guest are reading different surfaces. */
export function revealSummary(
  mode: 'instant' | 'event_end' | 'custom',
  locale: Locale = 'hu',
): string {
  const en = locale === 'en'
  switch (mode) {
    case 'instant':
      return en ? 'INSTANTLY' : 'AZONNAL'
    case 'event_end':
      return en ? 'AT THE END' : 'AZ ESEMÉNY VÉGÉN'
    default:
      return en ? 'LATER' : 'KÉSŐBB'
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
