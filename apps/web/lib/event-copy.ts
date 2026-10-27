import {
  captureWindowState,
  guestGalleryIsOpen,
  POST_EVENT_UPLOAD_MS,
  postEventUploadsAreOpen,
} from './camera'
import { formatDeadline } from './format'
import { huNumberArticle } from './host-ui'
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

/** One line summarising the event for the join screen. After the close it
 *  names the after-event upload window when the host opened one: "Shooting
 *  has ended" alone reads as "nothing left to do here", and a guest who
 *  never scanned at the party would close the tab without joining. */
export function joinStateLabel(
  timing: EventTiming,
  shotsPerParticipant: number,
  locale: Locale = 'hu',
  postEventUploads = false,
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
    if (
      postEventUploadsAreOpen({
        now: timing.now,
        captureEndAt: timing.captureEndAt,
        enabled: postEventUploads,
      })
    ) {
      const deadline = formatDeadline(
        new Date(
          timing.captureEndAt.getTime() + POST_EVENT_UPLOAD_MS,
        ).toISOString(),
        timing.timeZone,
        locale,
      )
      return locale === 'en'
        ? `Shooting has ended. You can still add photos from your phone until ${deadline}.`
        : `A fotózás véget ért. ${deadline}-ig még hozzáadhatsz képeket a telefonodról.`
    }
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
 * `Előhívás: 1N 5Ó` — the label on a tile in the locked gallery.
 *
 * The short spelling, because it sits on a 120px tile. Once the instant has
 * passed and the page has not caught up yet, it says so rather than counting
 * down to `0P` and staying there.
 */
export function developingTileLabel(
  revealAt: Date,
  now: Date,
  locale: Locale = 'hu',
): string {
  const en = locale === 'en'
  if (now.getTime() >= revealAt.getTime()) {
    return en ? 'Developing now' : 'Most hívódik elő'
  }
  const left = shortTimeRemaining(revealAt, now, locale)
  return en ? `Reveals in ${left}` : `Előhívás: ${left}`
}

/** `+12 további` — the last cell when more photos wait than the wall shows. */
export function moreDevelopingLabel(count: number, locale: Locale = 'hu') {
  return locale === 'en' ? `+${count} more` : `+${count} további`
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
  const { days, hours, minutes } = timeRemaining(captureEndAt, now)
  const [d, h, m] = en ? ['D', 'H', 'M'] : ['N', 'Ó', 'P']

  if (days > 0) return hours > 0 ? `${days}${d} ${hours}${h}` : `${days}${d}`
  if (hours > 0)
    return minutes > 0 ? `${hours}${h} ${minutes}${m}` : `${hours}${h}`
  return `${minutes}${m}`
}

/**
 * `6 óra 20 perc` — the same number, spelled out.
 *
 * The guest's status row is a sentence in the body face now, not a mono
 * readout, and `6Ó 20P` inside one reads as a serial number. Both spellings
 * come off `timeRemaining` so the two can never round differently: a host
 * seeing `2N 4Ó` and a guest seeing `2 nap 4 óra` are being told the same
 * thing about the same event.
 */
export function longTimeRemaining(
  captureEndAt: Date,
  now: Date,
  locale: Locale = 'hu',
): string {
  const en = locale === 'en'
  const { days, hours, minutes } = timeRemaining(captureEndAt, now)
  // Hungarian takes no plural after a numeral; English does.
  const unit = (value: number, hu: string, one: string) =>
    en ? `${value} ${one}${value === 1 ? '' : 's'}` : `${value} ${hu}`

  const d = unit(days, 'nap', 'day')
  const h = unit(hours, 'óra', 'hour')
  const m = unit(minutes, 'perc', 'minute')

  if (days > 0) return hours > 0 ? `${d} ${h}` : d
  if (hours > 0) return minutes > 0 ? `${h} ${m}` : h
  return m
}

/**
 * How much of the capture window is left, as whole units, floored to two.
 *
 * Rounded **up** to the minute so a window with thirty seconds in it says
 * "1 perc" rather than "0 perc" — a guest told there is no time left stops
 * shooting, and there is still time left.
 */
function timeRemaining(
  captureEndAt: Date,
  now: Date,
): { days: number; hours: number; minutes: number } {
  const totalMinutes = Math.max(
    0,
    Math.ceil((captureEndAt.getTime() - now.getTime()) / 60_000),
  )
  return {
    days: Math.floor(totalMinutes / (24 * 60)),
    hours: Math.floor((totalMinutes % (24 * 60)) / 60),
    minutes: totalMinutes % 60,
  }
}

export type CaptureStatus = {
  /** Whether the camera is open — the one thing lilac is now allowed to mean. */
  live: boolean
  label: string
}

/**
 * The status row's right-hand end: a dot and a short phrase.
 *
 * Sentence case in the body face, approved in the v2 review. It was tracked-out
 * mono caps — `NYITVA · 6Ó 20P` — which reads as a readout, and the row now has
 * to carry a second state that is not a readout at all: no connection. Two
 * states in two registers would have looked like two different kinds of thing.
 *
 * It says nothing about the connection. That is the caller's to add, because
 * the network is a browser fact and this module only knows the window — see
 * `lib/use-online.ts`.
 */
export function captureStatus(
  timing: EventTiming,
  locale: Locale = 'hu',
): CaptureStatus {
  const en = locale === 'en'
  switch (captureWindowState(timing)) {
    case 'before':
      return { live: false, label: en ? 'Not open yet' : 'Még zárva' }
    case 'after':
      return { live: false, label: en ? 'Closed' : 'Lezárult' }
    default: {
      const left = longTimeRemaining(timing.captureEndAt, timing.now, locale)
      return {
        live: true,
        label: en ? `Open for another ${left}` : `Nyitva, még ${left}`,
      }
    }
  }
}

/** A state block's two lines: a heading and the sentence under it. */
export type GuestNotice = { title: string; body: string }

/**
 * "Nincs kapcsolat" (7g, guest view `11c`).
 *
 * The banner at the top of the guest page while the device is offline with
 * shots still owed. It is not a toast, and that is the whole design: a guest
 * can be out of signal for an entire wedding, so the sentence saying their
 * photos are safe has to stay on the screen the whole time.
 *
 * It does not ask the guest to keep the page open. Every shot it counts is in
 * IndexedDB and replays when the page is opened again; the one case where the
 * tab is the only copy is `heldInMemoryNotice`. It names no deadline either:
 * `lib/upload-queue.ts` owns how long a stored shot is kept, and a number here
 * would be a promise about a device nobody controls.
 */
export function offlineQueueNotice(
  count: number,
  locale: Locale = 'hu',
): GuestNotice {
  const one = count === 1
  return locale === 'en'
    ? {
        title: 'No connection',
        body: one
          ? '1 photo is saved on this phone and cannot be lost. Reopen the page with better signal and it will upload.'
          : `${count} photos are saved on this phone and cannot be lost. Reopen the page with better signal and they will upload.`,
      }
    : {
        title: 'Nincs kapcsolat',
        body: one
          ? '1 kép el van mentve a telefonon, nem veszhet el. Nyisd meg újra az oldalt jobb térerőn, és feltöltődik.'
          : `${count} kép el van mentve a telefonon, egyik sem veszhet el. Nyisd meg újra az oldalt jobb térerőn, és feltöltődnek.`,
      }
}

/**
 * "Ne zárd be az oldalt" — IndexedDB refused, so this tab is the only copy.
 *
 * The one guest state that is a real data-loss risk, and the only place the
 * page asks to be kept open. Shown online or offline: a held shot that is
 * uploading normally is still lost if the tab goes away before it lands.
 */
export function heldInMemoryNotice(
  count: number,
  locale: Locale = 'hu',
): GuestNotice {
  const one = count === 1
  return locale === 'en'
    ? {
        title: 'Do not close this page',
        body: one
          ? 'This phone could not save the photo, so this page is its only copy until it uploads.'
          : `This phone could not save ${count} photos, so this page is their only copy until they upload.`,
      }
    : {
        title: 'Ne zárd be az oldalt',
        body: one
          ? 'A telefon nem tudta elmenteni a képet, így amíg fel nem töltődik, csak ez az oldal őrzi.'
          : `A telefon ${count} képet nem tudott elmenteni, így amíg fel nem töltődnek, csak ez az oldal őrzi őket.`,
      }
}

/** The heading over a lost photo's message; the message is the body. */
export function lostPhotoTitle(locale: Locale = 'hu'): string {
  return locale === 'en'
    ? 'A photo did not reach the album'
    : 'Egy kép nem került az albumba'
}

/**
 * The free tier's edge, seen from the guest's side (7l).
 *
 * No checkout, no price and no payment: a wedding guest holding a phone is not
 * the person who can fix this. It names the limit, says what the host can do
 * and what to do after, because a guest told only "full" closes the tab.
 */
export function capReachedNotice(
  limit: number,
  locale: Locale = 'hu',
): GuestNotice {
  return locale === 'en'
    ? {
        title: 'This event is full',
        body: `Up to ${limit} guests can join this event, and all ${limit} places are taken. Ask the host to unlock the event, then scan the QR code again.`,
      }
    : {
        title: 'Ez az esemény betelt',
        body: `Erre az eseményre legfeljebb ${limit} vendég csatlakozhat, és mind ${huNumberArticle(limit)} ${limit} hely elfogyott. Kérd meg a szervezőt, hogy oldja fel az eseményt, aztán olvasd be újra a QR-kódot.`,
      }
}

/**
 * The spent roll (7m): every frame is taken, and when the guest gets to see
 * them. The gallery is a separate permission from the camera, so this says
 * which of its three states the event is in rather than promising a reveal
 * the host has switched off.
 */
export function spentRollNotice(
  timing: EventTiming,
  shots: number,
  locale: Locale = 'hu',
): GuestNotice {
  const en = locale === 'en'
  const taken = en
    ? `All ${shots} photos are taken.`
    : `Mind ${huNumberArticle(shots)} ${shots} kép elkészült.`
  let after: string
  if (guestGalleryIsOpen(timing)) {
    after = en
      ? 'The gallery is already open, and every photo is below.'
      : 'A galéria már nyitva, lent láthatod az összes képet.'
  } else if (!timing.guestsCanView) {
    after = en
      ? 'Only the host can see the photos at this event.'
      : 'Ennél az eseménynél a képeket csak a szervező láthatja.'
  } else {
    const at = formatDeadline(
      timing.revealAt.toISOString(),
      timing.timeZone,
      locale,
    )
    after = en
      ? `The gallery opens ${at}, and you can see every photo then.`
      : `A galéria ${at}-kor nyílik meg, és akkor láthatod az összes képet.`
  }
  return {
    title: en
      ? 'You have used all your photos'
      : 'Elhasználtad az összes képedet',
    body: `${taken} ${after}`,
  }
}

/**
 * "Mind a 3 kép feltöltve." — the one success sentence on the guest screen.
 *
 * It is deliberately narrow. A shot landing already announces itself three
 * times over (the frame develops, the progress fills, the counter rolls down),
 * and a line of text under all that was the fourth telling of the same news —
 * which is why this screen has had no success case at all. What earns one is
 * the *end of an outage*: the guest was told photos were waiting, and nobody
 * should have to infer from an absence that they went.
 *
 * So it names only shots taken while there was no connection, and it clears
 * the moment the next one is taken.
 */
export function queueClearedNote(count: number, locale: Locale = 'hu'): string {
  if (locale === 'en') {
    return count === 1
      ? 'Your photo uploaded.'
      : `All ${count} photos uploaded.`
  }
  return count === 1 ? 'A kép feltöltve.' : `Mind a ${count} kép feltöltve.`
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
