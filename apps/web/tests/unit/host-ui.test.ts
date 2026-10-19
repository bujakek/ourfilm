import { describe, expect, it } from 'vitest'

import { toastReducer } from '@/lib/host-ui'

describe('toastReducer', () => {
  it('show replaces the current toast and bumps the id', () => {
    const first = toastReducer(null, { type: 'show', text: 'a' })
    const second = toastReducer(first, { type: 'show', text: 'b' })
    expect(first).toEqual({ id: 1, text: 'a' })
    expect(second).toEqual({ id: 2, text: 'b' })
  })

  it('keeps an action label', () => {
    const s = toastReducer(null, {
      type: 'show',
      text: 'a',
      action: { label: 'Undo' },
    })
    expect(s?.action).toEqual({ label: 'Undo' })
  })

  it('expire with the current id clears it', () => {
    const s = toastReducer(null, { type: 'show', text: 'a' })
    expect(toastReducer(s, { type: 'expire', id: 1 })).toBeNull()
  })

  it('expire with an older id leaves the newer toast', () => {
    const a = toastReducer(null, { type: 'show', text: 'a' })
    const b = toastReducer(a, { type: 'show', text: 'b' })
    expect(toastReducer(b, { type: 'expire', id: 1 })).toBe(b)
  })

  it('dismiss clears', () => {
    const s = toastReducer(null, { type: 'show', text: 'a' })
    expect(toastReducer(s, { type: 'dismiss' })).toBeNull()
  })
})
