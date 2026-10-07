import { describe, expect, it, vi } from 'vitest'

import { guestsScreen } from '@/app/(product)/host/events/new/step-guests'

const base = {
  plan: 'free' as const,
  setPlan: vi.fn(),
  shots: 24 as const,
  setShots: vi.fn(),
  guestsCanView: true,
  setGuestsCanView: vi.fn(),
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

  it('saves the event before asking signed-in hosts for payment', () => {
    expect(guestsScreen({ ...base, signedIn: true }).cta).toBe('Létrehozás')
    expect(guestsScreen({ ...base, signedIn: true, plan: 'full' }).cta).toBe(
      'Tovább a mentéshez',
    )
  })

  it('localizes the save CTA', () => {
    expect(guestsScreen({ ...base, locale: 'en' }).cta).toBe('Continue to save')
  })

  it('still requires consent before either path can proceed', () => {
    for (const signedIn of [false, true]) {
      expect(
        guestsScreen({ ...base, signedIn, legalAccepted: false }).ctaDisabled,
      ).toBe(true)
    }
  })

  it('lets either plan save without asking for a billing country', () => {
    expect(guestsScreen(base).ctaDisabled).toBe(false)
    expect(guestsScreen({ ...base, plan: 'full' }).ctaDisabled).toBe(false)
  })

  it('keeps the submission pending state for both paths', () => {
    for (const signedIn of [false, true]) {
      expect(
        guestsScreen({ ...base, signedIn, pending: true }).ctaPending,
      ).toBe(true)
    }
  })
})
