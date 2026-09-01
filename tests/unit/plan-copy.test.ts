import { describe, expect, it } from 'vitest'

import { planNote, toPlanSource } from '@/lib/plan-copy'

/**
 * The reason an event is uncapped is the one thing on the billing card a host
 * could be actively misled by. These tests exist to pin the specific lie the
 * module was written to prevent: a comped event reading as a payment.
 */

describe('toPlanSource', () => {
  it('accepts every reason the database can return', () => {
    expect(toPlanSource('paid')).toBe('paid')
    expect(toPlanSource('early_couple')).toBe('early_couple')
    expect(toPlanSource('operator')).toBe('operator')
    expect(toPlanSource('admin')).toBe('admin')
  })

  it('treats null and anything unrecognised as capped', () => {
    expect(toPlanSource(null)).toBeNull()
    // A reason added to the database but not yet to the UI must read as
    // "no special reason" rather than crashing a settings page.
    expect(toPlanSource('some_future_reason')).toBeNull()
  })
})

describe('planNote', () => {
  it('shows the receipt for a payment', () => {
    expect(planNote('paid', 'hu', '12 900 Ft · 2026. 09. 01.')).toBe(
      'Kifizetve — 12 900 Ft · 2026. 09. 01.',
    )
    expect(planNote('paid', 'en', '39 USD')).toBe('Paid — 39 USD')
  })

  it('says nothing rather than asserting an amount it does not have', () => {
    expect(planNote('paid', 'hu', null)).toBeNull()
  })

  it('never describes a comped event as paid', () => {
    for (const locale of ['hu', 'en'] as const) {
      // The receipt argument is deliberately populated: even with a settled
      // payment's formatting available, a grant must not borrow it.
      const note = planNote('early_couple', locale, '12 900 Ft')
      expect(note).toBeTruthy()
      expect(note).not.toContain('12 900')
      expect(note?.toLowerCase()).not.toContain('paid')
      expect(note?.toLowerCase()).not.toContain('kifizetve')
    }
  })

  it('distinguishes an operator unlock from an Early Couple comp', () => {
    expect(planNote('early_couple', 'hu', null)).toContain(
      'Early Couple Program',
    )
    expect(planNote('operator', 'hu', null)).not.toContain(
      'Early Couple Program',
    )
  })

  it('leaves an admin-owned event to the card default', () => {
    // Uncapped because of the account, not the event. The card already says
    // exactly that, and a per-event sentence would be wrong.
    expect(planNote('admin', 'hu', null)).toBeNull()
    expect(planNote('admin', 'en', '12 900 Ft')).toBeNull()
  })

  it('has nothing to say about a free event', () => {
    expect(planNote(null, 'hu', null)).toBeNull()
  })
})
