import { describe, expect, it } from 'vitest'

import {
  captureStatus,
  formatLine,
  longTimeRemaining,
  offlineQueueNote,
  ownRollNote,
  queueClearedNote,
  revealSummary,
  shortTimeRemaining,
} from '@/lib/event-copy'

/**
 * The guest surface's derived copy.
 *
 * These are pure and clock-free by design — the server renders them and the
 * client re-renders them every thirty seconds, and the two must never disagree.
 * That is exactly what makes them worth testing without a browser.
 */

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const now = new Date('2026-06-13T14:00:00Z')

/** The window fields `captureStatus` reads, plus the gallery fields it does not. */
function timing(startOffset: number, endOffset: number) {
  return {
    now,
    captureStartAt: new Date(now.getTime() + startOffset),
    captureEndAt: new Date(now.getTime() + endOffset),
    revealAt: new Date(now.getTime() + endOffset),
    guestsCanView: true,
    timeZone: 'Europe/Budapest',
  }
}

describe('shortTimeRemaining', () => {
  it('shows at most two units', () => {
    // A guest reading a countdown does not need minutes when there are days
    // left, and the status row is nine characters of wide mono at 9.5px.
    const end = new Date(now.getTime() + 2 * DAY + 4 * HOUR + 37 * MINUTE)
    expect(shortTimeRemaining(end, now)).toBe('2N 4Ó')
    expect(shortTimeRemaining(end, now, 'en')).toBe('2D 4H')
  })

  it('drops the smaller unit when it is zero', () => {
    expect(shortTimeRemaining(new Date(now.getTime() + 3 * DAY), now)).toBe(
      '3N',
    )
    expect(shortTimeRemaining(new Date(now.getTime() + 5 * HOUR), now)).toBe(
      '5Ó',
    )
  })

  it('falls back to minutes inside the last hour', () => {
    const end = new Date(now.getTime() + 20 * MINUTE)
    expect(shortTimeRemaining(end, now)).toBe('20P')
    expect(shortTimeRemaining(end, now, 'en')).toBe('20M')
  })

  it('never counts below zero once the camera has closed', () => {
    const past = new Date(now.getTime() - 3 * HOUR)
    expect(shortTimeRemaining(past, now)).toBe('0P')
  })
})

describe('longTimeRemaining', () => {
  const end = (ms: number) => new Date(now.getTime() + ms)

  it('spells out the same two units the short form abbreviates', () => {
    expect(longTimeRemaining(end(6 * HOUR + 20 * MINUTE), now)).toBe(
      '6 óra 20 perc',
    )
    expect(longTimeRemaining(end(6 * HOUR + 20 * MINUTE), now, 'en')).toBe(
      '6 hours 20 minutes',
    )
  })

  it('drops the smaller unit once there are days, like the short form', () => {
    expect(longTimeRemaining(end(2 * DAY + 4 * HOUR + 30 * MINUTE), now)).toBe(
      '2 nap 4 óra',
    )
  })

  it('takes no Hungarian plural after a numeral, and an English one', () => {
    expect(longTimeRemaining(end(HOUR + MINUTE), now)).toBe('1 óra 1 perc')
    expect(longTimeRemaining(end(HOUR + MINUTE), now, 'en')).toBe(
      '1 hour 1 minute',
    )
  })

  it('rounds up, so a window still open never reads as zero', () => {
    expect(longTimeRemaining(end(30_000), now)).toBe('1 perc')
  })
})

describe('captureStatus', () => {
  it('is live only while the window is open', () => {
    expect(captureStatus(timing(-HOUR, 6 * HOUR + 20 * MINUTE))).toEqual({
      live: true,
      label: 'Nyitva, még 6 óra 20 perc',
    })
    expect(captureStatus(timing(-HOUR, 6 * HOUR), 'en').label).toBe(
      'Open for another 6 hours',
    )
  })

  it('is not live before the camera opens or after it closes', () => {
    // `live` is what the lilac dot is bound to, and lilac now means exactly one
    // thing: the film is running. Amber is the connection, and this function
    // knows nothing about it.
    expect(captureStatus(timing(HOUR, 5 * HOUR)).live).toBe(false)
    expect(captureStatus(timing(-5 * HOUR, -HOUR)).live).toBe(false)
    expect(captureStatus(timing(-5 * HOUR, -HOUR)).label).toBe('Lezárult')
    expect(captureStatus(timing(HOUR, 5 * HOUR), 'en').label).toBe(
      'Not open yet',
    )
  })
})

describe('offlineQueueNote', () => {
  it('tells the guest to keep shooting only while they still can', () => {
    expect(offlineQueueNote(3, true)).toBe(
      'Nincs kapcsolat. 3 kép várakozik, nyugodtan fotózz tovább.',
    )
    // No film left, so the invitation would be a lie.
    expect(offlineQueueNote(3, false)).toBe(
      'Nincs kapcsolat. 3 kép várakozik a feltöltésre.',
    )
  })

  it('takes an English plural and no Hungarian one', () => {
    expect(offlineQueueNote(1, true, 'en')).toBe(
      'No connection. 1 photo waiting — keep shooting.',
    )
    expect(offlineQueueNote(2, false, 'en')).toBe(
      'No connection. 2 photos waiting to upload.',
    )
    expect(offlineQueueNote(1, true)).toContain('1 kép várakozik')
  })
})

describe('queueClearedNote', () => {
  it('does not say "mind a 1 kép"', () => {
    expect(queueClearedNote(1)).toBe('A kép feltöltve.')
    expect(queueClearedNote(3)).toBe('Mind a 3 kép feltöltve.')
    expect(queueClearedNote(1, 'en')).toBe('Your photo uploaded.')
    expect(queueClearedNote(3, 'en')).toBe('All 3 photos uploaded.')
  })
})

describe('formatLine', () => {
  it('states the format the product actually is', () => {
    expect(formatLine(7)).toBe(
      '7 vendég fotózott, előnézet és újrapróbálás nélkül.',
    )
    expect(formatLine(7, 'en')).toBe(
      '7 guests took photos, with no preview and no retakes.',
    )
  })

  it('keeps English singular honest', () => {
    expect(formatLine(1, 'en')).toBe(
      '1 guest took photos, with no preview and no retakes.',
    )
    // Hungarian takes no plural after a numeral.
    expect(formatLine(1)).toContain('1 vendég ')
  })
})

describe('revealSummary', () => {
  it('names each reveal rule in mono caps', () => {
    expect(revealSummary('instant')).toBe('AZONNAL')
    expect(revealSummary('event_end')).toBe('AZ ESEMÉNY VÉGÉN')
    expect(revealSummary('instant', 'en')).toBe('INSTANTLY')
    expect(revealSummary('event_end', 'en')).toBe('AT THE END')
  })

  it('still answers for the legacy custom mode', () => {
    // Not a product setting any more, but rows predating the change still
    // carry it and a ticket must not render an empty cell.
    expect(revealSummary('custom')).toBe('KÉSŐBB')
  })
})

describe('ownRollNote', () => {
  it('separates the guest’s own frames from the shared gallery', () => {
    // The strip is never reveal-gated and the gallery always is, so the locked
    // state has to say which is which or it reads as a bug.
    expect(ownRollNote()).toContain('már a tieid')
    expect(ownRollNote('en')).toContain('already yours')
  })
})
