/**
 * What the two legal forms accept, and what they refuse.
 *
 *     pnpm test
 *
 * These run against the schemas rather than the server module, which holds the
 * service-role client and cannot be imported outside a server runtime. Same
 * schemas, no database — see the header of `lib/legal/request-schemas.ts`.
 */
import { describe, expect, it } from 'vitest'

import { reportSchema, withdrawalSchema } from '@/lib/legal/request-schemas'
import { newPublicReference } from '@/lib/legal/reference'

const validWithdrawal = {
  fullName: 'Példa Anna',
  orderReference: 'ORD-2026-0042',
  email: 'anna@example.com',
}

describe('withdrawal declaration', () => {
  it('accepts the three required fields', () => {
    const parsed = withdrawalSchema.parse(validWithdrawal)
    expect(parsed.fullName).toBe('Példa Anna')
    expect(parsed.note).toBeUndefined()
  })

  it('trims and collapses whitespace a paste brings', () => {
    expect(
      withdrawalSchema.parse({
        ...validWithdrawal,
        fullName: '  Példa   Anna ',
      }).fullName,
    ).toBe('Példa Anna')
  })

  it('refuses a missing order reference', () => {
    expect(
      withdrawalSchema.safeParse({ ...validWithdrawal, orderReference: '   ' })
        .success,
    ).toBe(false)
  })

  it('refuses something that is not an email address', () => {
    expect(
      withdrawalSchema.safeParse({ ...validWithdrawal, email: 'anna' }).success,
    ).toBe(false)
  })

  it('refuses an unbounded note', () => {
    expect(
      withdrawalSchema.safeParse({
        ...validWithdrawal,
        note: 'x'.repeat(4001),
      }).success,
    ).toBe(false)
  })
})

const validReport = {
  reporterName: 'Példa Béla',
  reporterEmail: 'bela@example.com',
  eventReference: 'https://ourfilm.app/e/anna-peter-k3f9x7',
  contentReference: 'A harmadik kép a galéria tetején.',
  reason: 'Engedély nélkül készült rólam.',
  legalBasis: 'Képmáshoz fűződő jog.',
  goodFaith: true as const,
}

describe('content report', () => {
  it('accepts a complete report', () => {
    expect(reportSchema.safeParse(validReport).success).toBe(true)
  })

  it('refuses a report without the good-faith declaration', () => {
    // Not a formality: the database has a check constraint on the same column,
    // so a row that said otherwise would be a form bug rather than a report.
    expect(
      reportSchema.safeParse({ ...validReport, goodFaith: false }).success,
    ).toBe(false)
  })

  it('requires every substantive field', () => {
    for (const field of [
      'eventReference',
      'contentReference',
      'reason',
      'legalBasis',
    ] as const) {
      expect(
        reportSchema.safeParse({ ...validReport, [field]: '  ' }).success,
      ).toBe(false)
    }
  })

  it('keeps newlines in the long fields', () => {
    const parsed = reportSchema.parse({
      ...validReport,
      reason: 'Első sor.\nMásodik sor.',
    })
    expect(parsed.reason).toBe('Első sor.\nMásodik sor.')
  })
})

describe('public reference', () => {
  it('is prefixed, readable, and not sequential', () => {
    const a = newPublicReference('ELA')
    const b = newPublicReference('ELA')
    expect(a).toMatch(
      /^ELA-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/,
    )
    expect(a).not.toBe(b)
  })

  it('avoids the characters people misread aloud', () => {
    // No 0/O, no 1/I/L. This gets spelled out over the phone.
    const many = Array.from({ length: 200 }, () => newPublicReference('BEJ'))
    expect(many.join('').replace(/^|BEJ|-/g, '')).not.toMatch(/[01OIL]/)
  })
})
