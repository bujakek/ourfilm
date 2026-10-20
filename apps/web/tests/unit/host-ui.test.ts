import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  autosaveOutcome,
  captureEndDisplay,
  huNumberArticle,
  initialToastState,
  quotaBannerState,
  RESEND_COOLDOWN_S,
  resendSecondsLeft,
  SIGN_IN_LINK_TTL_MINUTES,
  toastReducer,
} from '@/lib/host-ui'

const show = (s = initialToastState, text = 'a') =>
  toastReducer(s, { type: 'show', text })

describe('toastReducer', () => {
  it('show replaces the current toast and bumps the id', () => {
    const first = show()
    const second = show(first, 'b')
    expect(first.toast).toEqual({ id: 1, text: 'a' })
    expect(second.toast).toEqual({ id: 2, text: 'b' })
  })

  it('keeps an action label', () => {
    const s = toastReducer(initialToastState, {
      type: 'show',
      text: 'a',
      action: { label: 'Undo' },
    })
    expect(s.toast?.action).toEqual({ label: 'Undo' })
  })

  it('expire with the current id clears it', () => {
    expect(toastReducer(show(), { type: 'expire', id: 1 }).toast).toBeNull()
  })

  it('expire with an older id leaves the newer toast', () => {
    const b = show(show(), 'b')
    expect(toastReducer(b, { type: 'expire', id: 1 })).toBe(b)
  })

  it('dismiss clears', () => {
    expect(toastReducer(show(), { type: 'dismiss' }).toast).toBeNull()
  })

  it('ids stay monotonic across a dismiss, and a stale expire is a no-op', () => {
    const dismissed = toastReducer(show(), { type: 'dismiss' })
    const again = show(dismissed, 'b')
    expect(again.toast?.id).toBe(2)
    expect(toastReducer(again, { type: 'expire', id: 1 })).toBe(again)
  })
})

describe('quotaBannerState', () => {
  const q = (count: number, limit = 5, unlimited = false) =>
    quotaBannerState({ count, limit, unlimited })

  it('is quiet until one seat is left', () => {
    expect(q(3)).toBeNull()
  })
  it('is near at limit - 1', () => {
    expect(q(4)).toBe('near')
  })
  it('is full at and beyond the limit', () => {
    expect(q(5)).toBe('full')
    expect(q(6)).toBe('full')
  })
  it('is never shown on an unlimited event', () => {
    expect(q(5, 5, true)).toBeNull()
  })
  it('handles a limit of one', () => {
    expect(q(0, 1)).toBe('near')
  })
})

describe('autosaveOutcome', () => {
  it('autosave reports failure without a saved flash', () => {
    expect(autosaveOutcome('error')).toEqual({
      flashSaved: false,
      revert: true,
      toast: 'retry',
    })
  })

  it('a save that lands flashes and keeps the value', () => {
    expect(autosaveOutcome('ok')).toEqual({
      flashSaved: true,
      revert: false,
      toast: null,
    })
  })
})

describe('captureEndDisplay', () => {
  it('capture end in the past keeps the stored value', () => {
    expect(
      captureEndDisplay('2026-09-04T02:00', '2026-09-01T02:00', true),
    ).toEqual({ value: '2026-09-04T02:00', error: true })
  })

  it('an accepted change shows what was picked', () => {
    expect(
      captureEndDisplay('2026-09-04T02:00', '2026-09-05T23:00', false),
    ).toEqual({ value: '2026-09-05T23:00', error: false })
  })
})

describe('resendSecondsLeft', () => {
  it('counts down from the cooldown and clamps at zero', () => {
    expect(RESEND_COOLDOWN_S).toBe(60)
    expect(resendSecondsLeft(0, 0)).toBe(60)
    expect(resendSecondsLeft(0, 18_000)).toBe(42)
    expect(resendSecondsLeft(0, 61_000)).toBe(0)
  })
})

describe('SIGN_IN_LINK_TTL_MINUTES', () => {
  it('matches otp_expiry in supabase/config.toml', () => {
    const toml = readFileSync(
      join(__dirname, '..', '..', '..', '..', 'supabase', 'config.toml'),
      'utf8',
    )
    // The [auth.email] table runs until the next table header.
    const section = toml.split(/^\[auth\.email\]\s*$/m)[1]?.split(/^\[/m)[0]
    const expiry = section?.match(/^otp_expiry\s*=\s*(\d+)/m)?.[1]
    expect(expiry).toBeDefined()
    expect(SIGN_IN_LINK_TTL_MINUTES * 60).toBe(Number(expiry))
  })
})

describe('huNumberArticle', () => {
  it('is az before a numeral read with a vowel, a otherwise', () => {
    const az = [1, 5, 50, 57, 500, 512, 1000, 1999, 5000, 50_000, 1_000_000]
    const a = [0, 2, 3, 4, 10, 12, 20, 84, 100, 412, 2000, 10_000, 100_000]
    for (const n of az) expect([n, huNumberArticle(n)]).toEqual([n, 'az'])
    for (const n of a) expect([n, huNumberArticle(n)]).toEqual([n, 'a'])
  })
})
