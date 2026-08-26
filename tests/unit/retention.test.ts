/**
 * The retention rule as arithmetic.
 *
 *     pnpm test
 *
 * The rule is stated in three places — the ÁSZF, the host's settings card and
 * the retention run — and all three read `lib/retention.ts`. What is tested
 * here is that the arithmetic matches the SQL the run actually queries with:
 * `capture_end_at + interval '6 months' + interval '30 days'`, which is
 * calendar months, not 180 days.
 */
import { describe, expect, it } from 'vitest'

import {
  ACTIVE_MONTHS,
  addMonthsUtc,
  GRACE_DAYS,
  retentionDates,
  retentionState,
} from '@/lib/retention'

describe('the published periods', () => {
  it('are the ones the ÁSZF states', () => {
    expect(ACTIVE_MONTHS).toBe(6)
    expect(GRACE_DAYS).toBe(30)
  })
})

describe('addMonthsUtc', () => {
  it('adds calendar months, matching Postgres', () => {
    expect(
      addMonthsUtc(new Date('2026-08-26T20:00:00.000Z'), 6).toISOString(),
    ).toBe('2027-02-26T20:00:00.000Z')
  })

  it('clamps to the last day when the target month is shorter', () => {
    // 31 August + 6 months is 28 February, not 3 March. A naive
    // `setUTCMonth` would roll over and move a deletion date into the next
    // month, which is the wrong direction to be wrong about erasure.
    expect(
      addMonthsUtc(new Date('2026-08-31T12:00:00.000Z'), 6).toISOString(),
    ).toBe('2027-02-28T12:00:00.000Z')
  })

  it('handles a leap February', () => {
    expect(
      addMonthsUtc(new Date('2027-08-31T12:00:00.000Z'), 6).toISOString(),
    ).toBe('2028-02-29T12:00:00.000Z')
  })
})

describe('retentionDates', () => {
  const end = new Date('2026-09-01T18:00:00.000Z')
  const { activeUntil, deleteAfter } = retentionDates(end)

  it('keeps the album active for six months', () => {
    expect(activeUntil.toISOString()).toBe('2027-03-01T18:00:00.000Z')
  })

  it('adds thirty days of grace after that', () => {
    expect(deleteAfter.toISOString()).toBe('2027-03-31T18:00:00.000Z')
  })
})

describe('retentionState', () => {
  const captureEndAt = new Date('2026-09-01T18:00:00.000Z')

  const at = (iso: string, legalHoldAt: Date | null = null) =>
    retentionState({ now: new Date(iso), captureEndAt, legalHoldAt })

  it('is active the day the event ends', () => {
    expect(at('2026-09-01T18:00:01.000Z')).toBe('active')
  })

  it('is active one second before the six months are up', () => {
    expect(at('2027-03-01T17:59:59.000Z')).toBe('active')
  })

  it('enters the grace period exactly at six months', () => {
    expect(at('2027-03-01T18:00:00.000Z')).toBe('grace')
  })

  it('is still in grace one second before the thirty days are up', () => {
    expect(at('2027-03-31T17:59:59.000Z')).toBe('grace')
  })

  it('becomes due exactly when the grace period ends', () => {
    expect(at('2027-03-31T18:00:00.000Z')).toBe('due')
  })

  it('a legal hold suspends deletion at every stage', () => {
    // A hold does not restrict access — that is a separate decision. All it
    // does is take the event out of the deletion queue, and say why.
    const hold = new Date('2027-01-01T00:00:00.000Z')
    expect(at('2026-09-02T00:00:00.000Z', hold)).toBe('hold')
    expect(at('2027-06-01T00:00:00.000Z', hold)).toBe('hold')
  })
})
