import type { KnownLocale } from '@/lib/i18n'

const HU_DATE = new Intl.DateTimeFormat('hu-HU', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
})

/**
 * Formats an `event_date` as `2026. június 13.`
 *
 * `event_date` is a Postgres `date` — a calendar day with no time and no zone,
 * arriving as `"2026-06-13"`. Parsing that gives UTC midnight, so formatting it
 * in any timezone behind UTC renders the *previous day*: a wedding on the 13th
 * shows up as június 12. Rendering happens on the server, whose timezone is not
 * ours to assume, so the formatter is pinned to UTC to stay deterministic.
 */
export function formatEventDate(date: string | null): string | null {
  if (!date) return null
  return HU_DATE.format(new Date(`${date}T00:00:00Z`))
}

/**
 * Formats an article's `publishedAt` in the reader's language.
 *
 * Same UTC pinning as `formatEventDate` above and for the same reason: a
 * frontmatter date is a calendar day, not an instant, so rendering it in a zone
 * behind UTC would date every article to the day before. One formatter per
 * locale, built once at module scope.
 */
const POST_DATE: Record<KnownLocale, Intl.DateTimeFormat> = {
  hu: HU_DATE,
  en: new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }),
}

export function formatPostDate(date: string, locale: KnownLocale): string {
  return POST_DATE[locale].format(new Date(`${date}T00:00:00Z`))
}

/**
 * The zone an event's clock times are rendered in, when nothing says otherwise.
 *
 * Unlike `formatPostDate` above, a `timestamptz` is an exact instant, so showing
 * it needs *a* zone — and pinning to UTC would be the bug rather than the fix,
 * labelling a photo taken at 14:32 as 12:32. Vercel runs UTC, so the server's
 * own zone is no help either.
 *
 * Every event now carries its own `time_zone`, so this is only the default the
 * create wizard pre-selects and the fallback for anything not tied to one
 * event. Pass the event's zone wherever you have it: a host who sets up a
 * camera for a wedding abroad has told us which clock the guests are on, and
 * rendering their deadline in Budapest time would be ignoring the answer.
 */
export const EVENT_TIME_ZONE = 'Europe/Budapest'

/**
 * The zones the create wizard offers.
 *
 * A short list rather than the full IANA database: the product is Hungarian and
 * the realistic answers are "here" or "the country we are getting married in".
 * A 400-entry select on a 390px phone is a worse question than a wrong default.
 * The column takes any IANA name, so widening this is copy, not schema.
 */
export const EVENT_TIME_ZONES = [
  'Europe/Budapest',
  'Europe/London',
  'Europe/Lisbon',
  'Europe/Athens',
  'Europe/Istanbul',
  'Atlantic/Canary',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Tokyo',
] as const

/** Hungarian labels for the zones above. A guest never sees these; a host picks
 *  one once, so it reads as a place rather than an offset. */
export const EVENT_TIME_ZONE_LABELS: Record<string, string> = {
  'Europe/Budapest': 'Budapest',
  'Europe/London': 'London',
  'Europe/Lisbon': 'Lisszabon',
  'Europe/Athens': 'Athén',
  'Europe/Istanbul': 'Isztambul',
  'Atlantic/Canary': 'Kanári-szigetek',
  'America/New_York': 'New York',
  'America/Los_Angeles': 'Los Angeles',
  'Asia/Dubai': 'Dubaj',
  'Asia/Tokyo': 'Tokió',
}

export function eventTimeZoneLabel(zone: string): string {
  return EVENT_TIME_ZONE_LABELS[zone] ?? zone
}

/** Whether a string is a zone this runtime can actually format in. The value
 *  reaches us from a form, and an unknown zone makes `Intl` throw at render
 *  time rather than at the point it was accepted. */
export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

/**
 * Formatters are expensive to construct and there are only ever a handful of
 * distinct zones in play, so they are built once per zone and kept.
 */
function memoFormatter(
  cache: Map<string, Intl.DateTimeFormat>,
  zone: string,
  build: (zone: string) => Intl.DateTimeFormat,
): Intl.DateTimeFormat {
  const hit = cache.get(zone)
  if (hit) return hit
  const made = build(zone)
  cache.set(zone, made)
  return made
}

const PARTS_CACHE = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(zone: string) {
  return memoFormatter(
    PARTS_CACHE,
    zone,
    (tz) =>
      new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        // h23 rather than hour12:false — the latter renders midnight as 24
        // under some ICU builds, which would sort a photo to the wrong end of
        // the day.
        hourCycle: 'h23',
        timeZone: tz,
      }),
  )
}

function eventParts(iso: string, zone: string) {
  const found = Object.fromEntries(
    partsFormatter(zone)
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value]),
  )
  return found as Record<
    'year' | 'month' | 'day' | 'hour' | 'minute' | 'second',
    string
  >
}

/**
 * `2026-08-15_1432`, for filenames inside the album ZIP.
 *
 * Sorts chronologically as plain text, and keeps meaning once a file is dragged
 * out of the folder and away from its numbering.
 */
export function formatFileStamp(iso: string, zone = EVENT_TIME_ZONE): string {
  const p = eventParts(iso, zone)
  return `${p.year}-${p.month}-${p.day}_${p.hour}${p.minute}`
}

/** `2026:08:15 14:32:10` — the EXIF spelling of a timestamp, in the event's
 *  zone. Colons in the date half are not a typo; that is the format. */
export function eventStamp(iso: string, zone = EVENT_TIME_ZONE): string {
  const p = eventParts(iso, zone)
  return `${p.year}:${p.month}:${p.day} ${p.hour}:${p.minute}:${p.second}`
}

const OFFSET_CACHE = new Map<string, Intl.DateTimeFormat>()

/**
 * `+02:00` — the zone's UTC offset **on that date**, which is the whole reason
 * this is computed per timestamp rather than stored as a constant. Budapest is
 * +01:00 in January and +02:00 in July, so a wedding and a Christmas party
 * cannot share one answer.
 */
export function eventUtcOffset(iso: string, zone = EVENT_TIME_ZONE): string {
  const formatter = memoFormatter(
    OFFSET_CACHE,
    zone,
    (tz) =>
      new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        timeZoneName: 'longOffset',
      }),
  )
  const name = formatter
    .formatToParts(new Date(iso))
    .find((part) => part.type === 'timeZoneName')?.value
  // A zone sitting exactly on UTC formats as a bare "GMT" with no offset.
  const found = name ? /GMT([+-]\d{2}:\d{2})/.exec(name) : null
  return found ? found[1] : '+00:00'
}

/**
 * The same instant as a `Date` whose **local** fields read as the event's wall
 * clock.
 *
 * For a ZIP entry, not for display. A ZIP stores modification times as a DOS
 * timestamp, which carries no timezone at all — the archiver just writes the
 * `Date`'s local components, so the answer depends on the server's clock. That
 * is fine on a laptop in Budapest and wrong on Vercel, which runs UTC and would
 * label a photo taken at 14:32 as 12:32.
 *
 * Shifting the instant looks like a hack and is the opposite: a zone-less
 * timestamp means wall clock, so wall clock is what has to go in.
 */
export function eventWallClock(iso: string, zone = EVENT_TIME_ZONE): Date {
  const p = eventParts(iso, zone)
  return new Date(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  )
}

const MOMENT_CACHE = new Map<string, Intl.DateTimeFormat>()

/**
 * `2026. augusztus 20. 14:32` — an exact instant rendered in the event's zone.
 *
 * Unlike a `date` column, which has no time to get wrong, a `timestamptz` must
 * pick a zone. UTC would be the bug rather than the fix here: a payment made at
 * 00:30 Budapest time would show on the previous day's receipt.
 */
export function formatMoment(iso: string, zone = EVENT_TIME_ZONE): string {
  return memoFormatter(
    MOMENT_CACHE,
    zone,
    (tz) =>
      new Intl.DateTimeFormat('hu-HU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: tz,
      }),
  ).format(new Date(iso))
}

const DEADLINE_CACHE = new Map<string, Intl.DateTimeFormat>()

/**
 * `2026. aug. 29. 23:59` — a capture or reveal moment, short enough for a table
 * row.
 *
 * Same instant-in-the-event's-zone rule as `formatMoment`; the month is
 * abbreviated because this appears next to an event name in the admin list and
 * under the title on a 390px phone, where the long form pushes to a second
 * line. The year stays: a wedding booked for next January is not a hypothesis.
 */
export function formatDeadline(iso: string, zone = EVENT_TIME_ZONE): string {
  return memoFormatter(
    DEADLINE_CACHE,
    zone,
    (tz) =>
      new Intl.DateTimeFormat('hu-HU', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: tz,
      }),
  ).format(new Date(iso))
}

/**
 * `2026-08-29T23:59` — an instant as an `<input type="datetime-local">` value,
 * read in the event's zone.
 *
 * The input has no timezone of its own: it shows whatever wall clock it is
 * handed. Handing it the browser's would mean a host abroad sees a deadline an
 * hour off the one the guests are held to, so it gets the event's instead.
 */
export function formatEventLocalInput(
  date: Date,
  zone = EVENT_TIME_ZONE,
): string {
  const p = eventParts(date.toISOString(), zone)
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

/**
 * The reverse: a `datetime-local` value read as event-zone wall clock.
 *
 * Returns null for anything that is not one, which is the validation — the
 * value arrives in a `FormData` and a form field is only ever a suggestion.
 *
 * The zone offset is a property of the instant, not of the wall clock, so it
 * has to be looked up from an instant we do not have yet. Reading the same
 * wall clock as UTC is close enough to land on the correct side of every DST
 * boundary except within the switch hour itself — where the clock is genuinely
 * ambiguous and no answer is the right one.
 */
export function eventLocalToIso(
  local: string,
  zone = EVENT_TIME_ZONE,
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null
  const guess = new Date(`${local}:00Z`)
  if (Number.isNaN(guess.getTime())) return null
  const exact = new Date(
    `${local}:00${eventUtcOffset(guess.toISOString(), zone)}`,
  )
  return Number.isNaN(exact.getTime()) ? null : exact.toISOString()
}
