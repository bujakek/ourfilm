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
export function formatEventDate(
  date: string | null,
  locale: KnownLocale = 'hu',
): string | null {
  if (!date) return null
  return POST_DATE[locale].format(new Date(`${date}T00:00:00Z`))
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
 * Every event carries its own `time_zone`, read off the host's browser when the
 * event is created, so this is only the server-render default and the fallback
 * for anything not tied to one event. Pass the event's zone wherever you have
 * it: a host who sets up a camera for a wedding abroad is on that clock, and
 * rendering their deadline in Budapest time would be ignoring it.
 *
 * There is deliberately no list of offered zones and no label map any more. The
 * flow never asks, and the admin never shows the answer — a host reads times in
 * the wall clock they typed, which is the only one they were ever thinking in.
 */
export const EVENT_TIME_ZONE = 'Europe/Budapest'

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
export function formatDeadline(
  iso: string,
  zone = EVENT_TIME_ZONE,
  locale: KnownLocale = 'hu',
): string {
  const key = `${locale}:${zone}`
  return memoFormatter(
    DEADLINE_CACHE,
    key,
    () =>
      new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'hu-HU', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: zone,
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

/**
 * `H K Sze Cs P Szo V` — the onboarding calendar's column headers, Monday-first.
 *
 * Written out rather than derived from `Intl`: hu-HU's narrow weekdays are
 * `V H K Sz Cs P Sz`, where szerda and szombat are both `Sz`. A calendar header
 * whose two columns carry the same label is not a header.
 */
export const HU_WEEKDAYS_SHORT = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']

const HU_MONTH_YEAR = new Intl.DateTimeFormat('hu-HU', {
  year: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

/**
 * `2026. augusztus` — the calendar's month heading.
 *
 * Takes the year and a 0-indexed month rather than a `Date`, because a calendar
 * grid is a calendar, not an instant: the month being drawn has no timezone to
 * get wrong. Formatted in UTC for the same reason `formatEventDate` is.
 */
export function formatHuMonthYear(year: number, month: number): string {
  return HU_MONTH_YEAR.format(new Date(Date.UTC(year, month, 1)))
}

const HU_LONG_DAY = new Intl.DateTimeFormat('hu-HU', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
  timeZone: 'UTC',
})

/** `2026. augusztus 24., hétfő` — the accessible name of one calendar cell.
 *  A screen reader user tabbing the grid gets the whole date; the visible
 *  label is only ever the number. */
export function formatHuCalendarDay(day: string): string {
  return HU_LONG_DAY.format(new Date(`${day}T00:00:00Z`))
}

const EVENT_DAY_CACHE = new Map<string, Intl.DateTimeFormat>()

/**
 * `szept. 5.` — the event's day, with no year and no clock.
 *
 * For the guest's ticket, which names the occasion rather than holding anyone
 * to a deadline: the times that matter there are already on it as a roll length
 * and a reveal rule. `formatDeadline` is the wrong tool because its year and
 * `23:00` are precisely what a ticket should not lead with.
 *
 * Rendered in the event's own zone like every other instant here — a party that
 * runs past midnight must not be dated to the next day for a guest whose phone
 * is somewhere else.
 */
export function formatEventDay(
  iso: string,
  zone = EVENT_TIME_ZONE,
  locale: KnownLocale = 'hu',
): string {
  const key = `${locale}:${zone}`
  return memoFormatter(
    EVENT_DAY_CACHE,
    key,
    () =>
      new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'hu-HU', {
        month: 'short',
        day: 'numeric',
        timeZone: zone,
      }),
  ).format(new Date(iso))
}

const REVEAL_BADGE_CACHE = new Map<string, Intl.DateTimeFormat>()

/**
 * `aug. 24. 20:42` — the reveal badge over the onboarding photo preview.
 *
 * `formatDeadline` with the year dropped. The year is load-bearing in the admin
 * list, where a wedding booked for next January sits next to one from last
 * week; here the moment is always within a month or so of a date the host has
 * just picked two screens earlier, and the year only costs width on a badge
 * that has to fit across two photos on a 390px phone.
 */
export function formatRevealBadge(
  iso: string,
  zone = EVENT_TIME_ZONE,
  locale: KnownLocale = 'hu',
): string {
  const key = `${locale}:${zone}`
  return memoFormatter(
    REVEAL_BADGE_CACHE,
    key,
    () =>
      new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'hu-HU', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: zone,
      }),
  ).format(new Date(iso))
}

/**
 * The IANA zone this browser is in, or the event default when it cannot be
 * read.
 *
 * Onboarding never asks for a zone: the host picks a wall clock and means the
 * one on the phone in their hand. Resolving it here rather than showing a
 * select is the whole difference between one question and two — but it can only
 * happen in the browser, so callers read it in an effect and start from
 * `EVENT_TIME_ZONE` for the server render.
 */
export function browserTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return zone && isValidTimeZone(zone) ? zone : EVENT_TIME_ZONE
  } catch {
    return EVENT_TIME_ZONE
  }
}
