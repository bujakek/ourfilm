import { describe, expect, it } from 'vitest'

import { initialToastState, toastReducer } from '@/lib/host-ui'

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
