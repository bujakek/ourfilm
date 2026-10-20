import { describe, expect, it, vi } from 'vitest'

import { guestsScreen } from '@/app/(product)/host/events/new/step-guests'

const base = {
  plan: 'free' as const,
  setPlan: vi.fn(),
  legalAccepted: true,
  setLegalAccepted: vi.fn(),
  paymentsEnabled: true,
  pending: false,
  locale: 'hu' as const,
  signedIn: false,
}

describe('the last question before saving', () => {
  it('leads signed-out and unresolved sessions to saving, on either plan', () => {
    for (const signedIn of [false, null]) {
      for (const plan of ['free', 'full'] as const) {
        expect(guestsScreen({ ...base, signedIn, plan }).cta).toBe(
          'Tovább a mentéshez',
        )
      }
    }
  })

  it('creates a signed-in free event, and sends a signed-in paid one to pay', () => {
    expect(guestsScreen({ ...base, signedIn: true }).cta).toBe('Létrehozás')
    expect(guestsScreen({ ...base, signedIn: true, plan: 'full' }).cta).toBe(
      'Tovább a fizetéshez',
    )
  })

  it('localizes the CTA', () => {
    expect(guestsScreen({ ...base, locale: 'en' }).cta).toBe('Continue to save')
    expect(
      guestsScreen({ ...base, locale: 'en', signedIn: true, plan: 'full' }).cta,
    ).toBe('Continue to payment')
  })

  it('accepts the free terms by pressing, under a terms line', () => {
    for (const signedIn of [false, true]) {
      const screen = guestsScreen({ ...base, signedIn, legalAccepted: false })
      expect(screen.ctaDisabled).toBe(false)
      expect(screen.footnote).toBeTruthy()
    }
  })

  it('holds the paid path until the declaration is ticked', () => {
    for (const signedIn of [false, true]) {
      expect(
        guestsScreen({ ...base, signedIn, plan: 'full', legalAccepted: false })
          .ctaDisabled,
      ).toBe(true)
      expect(
        guestsScreen({ ...base, signedIn, plan: 'full', legalAccepted: true })
          .ctaDisabled,
      ).toBe(false)
    }
  })

  it('paints only a signed-in paid path as a payment', () => {
    expect(
      guestsScreen({ ...base, signedIn: true, plan: 'full' }).ctaTone,
    ).toBe('pay')
    expect(guestsScreen({ ...base, signedIn: true }).ctaTone).toBeUndefined()
    expect(guestsScreen(base).ctaTone).toBeUndefined()
  })

  it('a signed-out paid path goes to saving first, so it wears the white primary', () => {
    for (const signedIn of [false, null]) {
      expect(
        guestsScreen({ ...base, signedIn, plan: 'full' }).ctaTone,
      ).toBeUndefined()
    }
  })

  it('drops the free terms line on the paid path', () => {
    expect(guestsScreen({ ...base, plan: 'full' }).footnote).toBeUndefined()
  })

  it('keeps the submission pending state for both paths', () => {
    for (const signedIn of [false, true]) {
      expect(
        guestsScreen({ ...base, signedIn, pending: true }).ctaPending,
      ).toBe(true)
    }
  })
})
