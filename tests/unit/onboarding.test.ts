import { describe, expect, it } from 'vitest'

import {
  DEFAULT_REVEAL_DELAY_DAYS,
  MAX_REVEAL_DELAY_DAYS,
  MIN_REVEAL_DELAY_DAYS,
  clampRevealDelayDays,
  eventNameSuggestions,
  formatDelayDays,
  FREE_PARTICIPANT_LIMIT,
  isEventPlan,
  revealAfterDelay,
} from '@/lib/onboarding'

const end = new Date('2026-08-25T22:30:00Z')

describe('reveal delay bounds', () => {
  it('offers one to thirty days, defaulting to one', () => {
    expect(MIN_REVEAL_DELAY_DAYS).toBe(1)
    expect(MAX_REVEAL_DELAY_DAYS).toBe(30)
    expect(DEFAULT_REVEAL_DELAY_DAYS).toBe(1)
  })

  it('clamps a stepper that ran past either end', () => {
    expect(clampRevealDelayDays(0)).toBe(1)
    expect(clampRevealDelayDays(-40)).toBe(1)
    expect(clampRevealDelayDays(31)).toBe(30)
    expect(clampRevealDelayDays(9999)).toBe(30)
  })

  it('keeps every value in range untouched', () => {
    for (let days = 1; days <= 30; days++) {
      expect(clampRevealDelayDays(days)).toBe(days)
    }
  })

  it('falls back rather than poisoning the arithmetic with NaN', () => {
    // The value also arrives in a FormData, where it is whatever the caller
    // decided to send. `new Date(end + NaN)` is an Invalid Date, which Postgres
    // would refuse with an error naming a column rather than a cause.
    for (const bad of ['', 'holnap', null, undefined, {}, NaN, Infinity]) {
      expect(clampRevealDelayDays(bad)).toBe(DEFAULT_REVEAL_DELAY_DAYS)
    }
  })

  it('reads a numeric string, because that is what a form field is', () => {
    expect(clampRevealDelayDays('7')).toBe(7)
    expect(clampRevealDelayDays('7.9')).toBe(7)
  })
})

describe('revealAfterDelay', () => {
  it('counts whole days from the end of the capture window', () => {
    expect(revealAfterDelay(end, 1).toISOString()).toBe(
      '2026-08-26T22:30:00.000Z',
    )
    expect(revealAfterDelay(end, 15).toISOString()).toBe(
      '2026-09-09T22:30:00.000Z',
    )
  })

  it('is always later than the window it delays', () => {
    for (let days = 1; days <= 30; days++) {
      expect(revealAfterDelay(end, days).getTime()).toBeGreaterThan(
        end.getTime(),
      )
    }
  })

  it('adds 24 hours per day across a DST boundary, not a wall clock', () => {
    // Budapest goes +02:00 -> +01:00 on 2026-10-25. Both answers are defensible
    // in the abstract; this one is the one the badge showed the host while they
    // were choosing, and that is the promise being kept.
    const before = new Date('2026-10-24T20:00:00Z')
    expect(revealAfterDelay(before, 2).toISOString()).toBe(
      '2026-10-26T20:00:00.000Z',
    )
  })

  it('clamps its own input, so a bad delay cannot produce a bad instant', () => {
    expect(revealAfterDelay(end, 0).toISOString()).toBe(
      '2026-08-26T22:30:00.000Z',
    )
    expect(revealAfterDelay(end, Number.NaN).toISOString()).toBe(
      '2026-08-26T22:30:00.000Z',
    )
  })
})

describe('formatDelayDays', () => {
  it('counts in Hungarian, which keeps the singular after a number', () => {
    expect(formatDelayDays(1)).toBe('1 nap')
    expect(formatDelayDays(2)).toBe('2 nap')
    expect(formatDelayDays(15)).toBe('15 nap')
  })
})

describe('eventNameSuggestions', () => {
  it('always offers five', () => {
    expect(eventNameSuggestions(null)).toHaveLength(5)
    expect(eventNameSuggestions('Anna')).toHaveLength(5)
  })

  it('personalises the first two when the host has a name', () => {
    expect(eventNameSuggestions('Anna').slice(0, 2)).toEqual([
      'Anna bulija',
      'Anna születésnapja',
    ])
  })

  it('falls back to generic titles without one — which is every account today', () => {
    expect(eventNameSuggestions(null).slice(0, 2)).toEqual([
      'A nagy bulink',
      'Születésnapi buli',
    ])
  })

  it('treats a blank name as no name', () => {
    expect(eventNameSuggestions('   ')).toEqual(eventNameSuggestions(null))
  })

  it('keeps the three impersonal titles either way', () => {
    const tail = ['Az esküvőnk', 'Az évfordulónk', 'A mi kis bulink']
    expect(eventNameSuggestions(null).slice(2)).toEqual(tail)
    expect(eventNameSuggestions('Anna').slice(2)).toEqual(tail)
  })
})

describe('event plan', () => {
  it('knows the two tiers and nothing else', () => {
    expect(isEventPlan('free')).toBe(true)
    expect(isEventPlan('unlimited')).toBe(true)
    // The value arrives in a FormData, so anything at all can turn up here —
    // and an unrecognised plan must be refused rather than quietly treated as
    // free, which would be a paid choice silently downgraded.
    for (const bad of ['', 'FREE', 'paid', '5', null, undefined, 0, {}]) {
      expect(isEventPlan(bad)).toBe(false)
    }
  })

  it('names the same free limit the database enforces', () => {
    // Mirrors public.free_participant_limit(). If that migration changes and
    // this does not, the last onboarding screen advertises the wrong number.
    expect(FREE_PARTICIPANT_LIMIT).toBe(5)
  })
})
