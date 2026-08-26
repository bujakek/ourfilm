import { describe, expect, it } from 'vitest'

import {
  EVENT_TIME_ZONE,
  eventLocalToIso,
  eventStamp,
  eventUtcOffset,
  eventWallClock,
  formatDeadline,
  formatEventLocalInput,
  formatFileStamp,
  formatHuCalendarDay,
  formatHuMonthYear,
  formatRevealBadge,
  HU_WEEKDAYS_SHORT,
  isValidTimeZone,
} from '@/lib/format'

/**
 * The timezone rules, which are the ones most likely to be quietly wrong.
 *
 * A `datetime-local` input carries no zone. Vercel runs UTC. Budapest is +01:00
 * in winter and +02:00 in summer. Get any of those three wrong and every
 * capture window in the product is off by an hour or two, silently, and only
 * for half the year.
 */

describe('eventUtcOffset', () => {
  it('follows DST rather than assuming one offset', () => {
    expect(eventUtcOffset('2026-01-15T12:00:00Z')).toBe('+01:00')
    expect(eventUtcOffset('2026-07-15T12:00:00Z')).toBe('+02:00')
  })

  it('answers per zone', () => {
    expect(eventUtcOffset('2026-07-15T12:00:00Z', 'America/New_York')).toBe(
      '-04:00',
    )
    expect(eventUtcOffset('2026-07-15T12:00:00Z', 'Asia/Tokyo')).toBe('+09:00')
  })

  it('reports +00:00 for a zone sitting on UTC', () => {
    // London in January formats as a bare "GMT" with no offset attached.
    expect(eventUtcOffset('2026-01-15T12:00:00Z', 'Europe/London')).toBe(
      '+00:00',
    )
  })
})

describe('eventLocalToIso', () => {
  it('reads a wall clock in the event zone, not the server zone', () => {
    // 22:00 in Budapest in June is 20:00Z. Reading it as UTC — which is what
    // Vercel would do left to itself — would close the camera two hours early.
    expect(eventLocalToIso('2026-06-13T22:00')).toBe('2026-06-13T20:00:00.000Z')
  })

  it('uses the winter offset in winter', () => {
    expect(eventLocalToIso('2026-01-13T22:00')).toBe('2026-01-13T21:00:00.000Z')
  })

  it('honours a zone other than the default', () => {
    expect(eventLocalToIso('2026-06-13T22:00', 'America/New_York')).toBe(
      '2026-06-14T02:00:00.000Z',
    )
    expect(eventLocalToIso('2026-06-13T22:00', 'Asia/Tokyo')).toBe(
      '2026-06-13T13:00:00.000Z',
    )
  })

  it('refuses anything that is not a datetime-local value', () => {
    // The value arrives in a FormData, so a form field is only ever a
    // suggestion.
    for (const bad of [
      '',
      '2026-06-13',
      '2026-06-13 22:00',
      '2026-06-13T22:00:00',
      'tomorrow',
      '9999-99-99T99:99',
    ]) {
      expect(eventLocalToIso(bad)).toBeNull()
    }
  })
})

describe('formatEventLocalInput', () => {
  it('round-trips through eventLocalToIso', () => {
    // The wizard writes a value into the input, the action reads it back. If
    // these two disagree, a host who opens settings and saves without touching
    // anything silently moves their own deadline.
    for (const local of [
      '2026-06-13T22:00',
      '2026-01-13T09:30',
      '2026-12-31T23:59',
    ]) {
      const iso = eventLocalToIso(local)
      expect(iso).not.toBeNull()
      expect(formatEventLocalInput(new Date(iso!))).toBe(local)
    }
  })

  it('round-trips in a non-default zone', () => {
    const local = '2026-06-13T22:00'
    const iso = eventLocalToIso(local, 'Asia/Tokyo')
    expect(formatEventLocalInput(new Date(iso!), 'Asia/Tokyo')).toBe(local)
  })

  it('renders the event zone, not the machine zone', () => {
    // 20:00Z is 22:00 in Budapest and 16:00 in New York. Neither answer depends
    // on where the test happens to run.
    const instant = new Date('2026-06-13T20:00:00Z')
    expect(formatEventLocalInput(instant, 'Europe/Budapest')).toBe(
      '2026-06-13T22:00',
    )
    expect(formatEventLocalInput(instant, 'America/New_York')).toBe(
      '2026-06-13T16:00',
    )
  })
})

describe('formatDeadline', () => {
  it('renders in the event zone', () => {
    const budapest = formatDeadline('2026-06-13T20:00:00Z', 'Europe/Budapest')
    const tokyo = formatDeadline('2026-06-13T20:00:00Z', 'Asia/Tokyo')
    expect(budapest).toContain('22:00')
    expect(tokyo).toContain('05:00')
    expect(budapest).not.toBe(tokyo)
  })

  it('renders midnight as 00, never 24', () => {
    // hourCycle h23: some ICU builds render midnight as 24 under
    // hour12:false, which would sort a photo to the wrong end of the day.
    expect(formatDeadline('2026-06-13T22:00:00Z', 'Europe/Budapest')).toContain(
      '00:00',
    )
  })
})

describe('file and EXIF stamps', () => {
  it('formats a sortable filename stamp in the event zone', () => {
    expect(formatFileStamp('2026-08-15T12:32:10Z', 'Europe/Budapest')).toBe(
      '2026-08-15_1432',
    )
  })

  it('formats an EXIF timestamp with colons in the date half', () => {
    expect(eventStamp('2026-08-15T12:32:10Z', 'Europe/Budapest')).toBe(
      '2026:08:15 14:32:10',
    )
  })

  it('gives a wall-clock Date for a zone-less ZIP entry', () => {
    // A ZIP's DOS timestamp carries no zone, so the archiver writes the Date's
    // local fields. Those have to read as the event's wall clock.
    const wall = eventWallClock('2026-08-15T12:32:10Z', 'Europe/Budapest')
    expect(wall.getHours()).toBe(14)
    expect(wall.getMinutes()).toBe(32)
    expect(wall.getDate()).toBe(15)
  })
})

describe('timezone validation', () => {
  it('accepts the zones the wizard offers', () => {
    expect(isValidTimeZone(EVENT_TIME_ZONE)).toBe(true)
    expect(isValidTimeZone('America/Los_Angeles')).toBe(true)
  })

  it('refuses a zone Intl cannot format in', () => {
    // The value reaches us from a hidden form field carrying whatever the
    // browser reported, and an unknown zone would otherwise throw at render
    // time rather than at the point it was accepted.
    for (const bad of ['', 'Mars/Olympus', 'Budapest', 'UTC+2']) {
      expect(isValidTimeZone(bad)).toBe(false)
    }
  })
})

describe('the onboarding calendar', () => {
  it('labels the columns Monday-first and unambiguously', () => {
    // hu-HU's own narrow weekdays are `V H K Sz Cs P Sz` — szerda and szombat
    // collide, which is why these are written out rather than derived.
    expect(HU_WEEKDAYS_SHORT).toEqual(['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'])
    expect(new Set(HU_WEEKDAYS_SHORT).size).toBe(7)
  })

  it('heads a month in Hungarian, from a bare year and month', () => {
    expect(formatHuMonthYear(2026, 7)).toBe('2026. augusztus')
    expect(formatHuMonthYear(2026, 0)).toBe('2026. január')
    expect(formatHuMonthYear(2027, 11)).toBe('2027. december')
  })

  it('gives a cell an accessible name a screen reader can act on', () => {
    expect(formatHuCalendarDay('2026-08-24')).toBe('2026. augusztus 24., hétfő')
  })
})

describe('formatRevealBadge', () => {
  it('drops the year that formatDeadline keeps', () => {
    // Same instant, one badge wide enough for two photos on a 390px phone.
    expect(formatRevealBadge('2026-08-25T22:30:00Z')).toBe('aug. 26. 00:30')
    expect(formatDeadline('2026-08-25T22:30:00Z')).toBe('2026. aug. 26. 00:30')
  })

  it("renders in the event's own zone, never the server's", () => {
    expect(formatRevealBadge('2026-08-25T22:30:00Z', 'America/New_York')).toBe(
      'aug. 25. 18:30',
    )
  })

  it('uses a 24-hour clock', () => {
    expect(formatRevealBadge('2026-08-25T18:00:00Z')).toBe('aug. 25. 20:00')
    expect(formatRevealBadge('2026-08-25T22:00:00Z')).toBe('aug. 26. 00:00')
  })
})
