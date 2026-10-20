import { describe, expect, it } from 'vitest'

import {
  activeQuickPick,
  endQuickPick,
  eventNameSuggestions,
  FREE_PARTICIPANT_LIMIT,
  isEventPlan,
} from '@/lib/onboarding'

describe('eventNameSuggestions', () => {
  it('offers three per locale', () => {
    expect(eventNameSuggestions(null)).toEqual([
      'Esküvőnk',
      'Szülinapi buli',
      'Egy felejthetetlen este',
    ])
    expect(eventNameSuggestions(null, 'en')).toEqual([
      'Our wedding',
      'Birthday party',
      'An unforgettable night',
    ])
    for (const locale of ['hu', 'en'] as const) {
      expect(eventNameSuggestions(null, locale)).toHaveLength(3)
      expect(eventNameSuggestions('Anna', locale)).toHaveLength(3)
    }
  })

  it('personalises the birthday when the host has a name', () => {
    expect(eventNameSuggestions('Anna')[1]).toBe('Anna szülinapja')
    expect(eventNameSuggestions('Anna', 'en')[1]).toBe('Anna’s birthday')
  })

  it('treats a blank name as no name — which is every account today', () => {
    expect(eventNameSuggestions('   ')).toEqual(eventNameSuggestions(null))
  })
})

describe('end quick picks', () => {
  // 15:00 in Budapest on 3 September (CEST, UTC+2).
  const NOW = new Date('2026-09-03T13:00:00Z')
  const ZONE = 'Europe/Budapest'

  it('lands a small-hours time tonight on tomorrow’s date', () => {
    expect(endQuickPick('tonight', '02:00', NOW, ZONE)).toBe('2026-09-04T02:00')
  })

  it('lands an evening time tonight on today’s date', () => {
    expect(endQuickPick('tonight', '23:00', NOW, ZONE)).toBe('2026-09-03T23:00')
    expect(endQuickPick('tonight', '12:00', NOW, ZONE)).toBe('2026-09-03T12:00')
  })

  it('puts tomorrow one day after tonight', () => {
    expect(endQuickPick('tomorrow', '02:00', NOW, ZONE)).toBe(
      '2026-09-05T02:00',
    )
    expect(endQuickPick('tomorrow', '23:00', NOW, ZONE)).toBe(
      '2026-09-04T23:00',
    )
  })

  it('reads today in the event’s zone, not UTC', () => {
    // 23:30 UTC on the 3rd is already 01:30 on the 4th in Budapest.
    const late = new Date('2026-09-03T23:30:00Z')
    expect(endQuickPick('tonight', '23:00', late, ZONE)).toBe(
      '2026-09-04T23:00',
    )
  })

  it('crosses a month end', () => {
    const lastDay = new Date('2026-09-30T13:00:00Z')
    expect(endQuickPick('tomorrow', '02:00', lastDay, ZONE)).toBe(
      '2026-10-02T02:00',
    )
  })

  it('maps each pick back to its kind', () => {
    expect(activeQuickPick('2026-09-04T02:00', NOW, ZONE)).toBe('tonight')
    expect(activeQuickPick('2026-09-03T23:00', NOW, ZONE)).toBe('tonight')
    expect(activeQuickPick('2026-09-05T02:00', NOW, ZONE)).toBe('tomorrow')
    expect(activeQuickPick('2026-09-04T23:00', NOW, ZONE)).toBe('tomorrow')
  })

  it('calls anything else another day', () => {
    for (const other of [
      '2026-09-03T02:00',
      '2026-09-06T23:00',
      '2026-09-05T23:00',
      '2026-10-04T02:00',
      '',
    ]) {
      expect(activeQuickPick(other, NOW, ZONE)).toBe('other')
    }
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
