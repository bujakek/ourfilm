import { describe, expect, it } from 'vitest'

import {
  eventNameSuggestions,
  FREE_PARTICIPANT_LIMIT,
  isEventPlan,
} from '@/lib/onboarding'

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
    expect(isEventPlan('full')).toBe(true)
    // The value arrives in a FormData, so anything at all can turn up here —
    // and an unrecognised plan must be refused rather than quietly treated as
    // free, which would be a paid choice silently downgraded.
    for (const bad of [
      '',
      'FREE',
      'unlimited',
      'paid',
      '5',
      null,
      undefined,
      0,
      {},
    ]) {
      expect(isEventPlan(bad)).toBe(false)
    }
  })

  it('names the same free limit the database enforces', () => {
    // Mirrors public.free_participant_limit(). If that migration changes and
    // this does not, the last onboarding screen advertises the wrong number.
    expect(FREE_PARTICIPANT_LIMIT).toBe(5)
  })
})
