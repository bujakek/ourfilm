import { describe, expect, it } from 'vitest'

import {
  autosaveOutcome,
  captureEndDisplay,
  initialToastState,
  quotaBannerState,
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
