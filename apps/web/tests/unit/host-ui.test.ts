import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  autosaveOutcome,
  captureEndCommit,
  captureEndDisplay,
  huNumberArticle,
  initialToastState,
  paymentNotice,
  quotaBannerState,
  RESEND_COOLDOWN_S,
  revealChoiceCommit,
  saveLedger,
  saveLedgerCommit,
  saveLedgerIssue,
  saveLedgerSettle,
  resendSecondsLeft,
  SIGN_IN_LINK_TTL_MINUTES,
  TOAST_MS,
  toastExpiry,
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

describe('toastExpiry', () => {
  const toast = { id: 3, text: 'a', action: { label: 'Undo' } }

  it('runs the full timer when nobody holds the toast', () => {
    expect(toastExpiry(toast, null)).toBe(TOAST_MS)
    expect(toastExpiry(toast, { id: 3, pointer: false, focus: false })).toBe(
      TOAST_MS,
    )
  })

  it('pauses while a pointer is over it or focus is inside it', () => {
    expect(
      toastExpiry(toast, { id: 3, pointer: true, focus: false }),
    ).toBeNull()
    expect(
      toastExpiry(toast, { id: 3, pointer: false, focus: true }),
    ).toBeNull()
  })

  it('a hold on an earlier toast does not pause its successor', () => {
    expect(toastExpiry(toast, { id: 2, pointer: true, focus: true })).toBe(
      TOAST_MS,
    )
  })

  it('has nothing to time without a toast', () => {
    expect(toastExpiry(null, null)).toBeNull()
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
  it('an end before the start keeps the stored value, outlined', () => {
    expect(captureEndDisplay('2026-09-04T02:00', true)).toEqual({
      value: '2026-09-04T02:00',
      error: true,
    })
  })

  it('any other failure also keeps the stored value, without the outline', () => {
    expect(captureEndDisplay('2026-09-04T02:00', false)).toEqual({
      value: '2026-09-04T02:00',
      error: false,
    })
  })
})

describe('captureEndCommit', () => {
  const start = '2026-10-18T18:00'
  const now = '2026-10-19T22:30'
  const future = '2026-10-21T20:00'

  it('refuses an end at or before the start, whichever part was picked', () => {
    for (const source of ['day', 'time'] as const) {
      expect(
        captureEndCommit({ stored: future, next: start, start, now, source }),
      ).toBe('refuse')
      expect(
        captureEndCommit({
          stored: future,
          next: '2026-10-18T17:00',
          start,
          now,
          source,
        }),
      ).toBe('refuse')
    }
  })

  it('holds a day pick that would close a camera that is still open', () => {
    expect(
      captureEndCommit({
        stored: future,
        next: '2026-10-19T20:00',
        start,
        now,
        source: 'day',
      }),
    ).toBe('hold')
    // "now" itself is already closed.
    expect(
      captureEndCommit({
        stored: future,
        next: now,
        start,
        now,
        source: 'day',
      }),
    ).toBe('hold')
  })

  it('saves a time commit in the past: both parts were chosen, so it is a deliberate close', () => {
    expect(
      captureEndCommit({
        stored: future,
        next: '2026-10-19T20:00',
        start,
        now,
        source: 'time',
      }),
    ).toBe('save')
  })

  it('saves a day pick that keeps the camera open', () => {
    expect(
      captureEndCommit({
        stored: future,
        next: '2026-10-20T20:00',
        start,
        now,
        source: 'day',
      }),
    ).toBe('save')
  })

  it('saves a past day when the camera is already closed: nothing closes', () => {
    expect(
      captureEndCommit({
        stored: '2026-10-19T21:00',
        next: '2026-10-19T20:00',
        start,
        now,
        source: 'day',
      }),
    ).toBe('save')
  })
})

describe('save ledger', () => {
  it('skips the value already in flight and leaves the stored value alone', () => {
    const l = saveLedger('a')
    expect(saveLedgerCommit(l, 'a')).toBe('unchanged')
    expect(saveLedgerCommit(l, 'b')).toBe('send')
    const { ledger } = saveLedgerIssue(l, 'b')
    expect(saveLedgerCommit(ledger, 'b')).toBe('skip')
    // The stored value typed back while another save is in flight is a
    // change: that save is about to replace it.
    expect(saveLedgerCommit(ledger, 'a')).toBe('send')
  })

  it('a landed save stores its value and clears the flight when it is the latest', () => {
    const { ledger, seq } = saveLedgerIssue(saveLedger('a'), 'b')
    const settled = saveLedgerSettle(ledger, seq, 'b', true)
    expect(settled.latest).toBe(true)
    expect(settled.ledger.stored).toBe('b')
    expect(settled.ledger.inFlight).toBeNull()
  })

  it('an overtaken save that lands still moves the stored value, but does not report', () => {
    const one = saveLedgerIssue(saveLedger('a'), 'b')
    const two = saveLedgerIssue(one.ledger, 'c')
    const settled = saveLedgerSettle(two.ledger, one.seq, 'b', true)
    expect(settled.latest).toBe(false)
    expect(settled.ledger.stored).toBe('b')
    expect(settled.ledger.inFlight).toBe('c')
  })

  it('an older save landing after a newer one does not undo it', () => {
    const one = saveLedgerIssue(saveLedger('a'), 'b')
    const two = saveLedgerIssue(one.ledger, 'c')
    const newer = saveLedgerSettle(two.ledger, two.seq, 'c', true)
    const older = saveLedgerSettle(newer.ledger, one.seq, 'b', true)
    expect(older.ledger.stored).toBe('c')
  })

  it('a failure keeps the stored value, and clears the flight only when latest', () => {
    const one = saveLedgerIssue(saveLedger('a'), 'b')
    const two = saveLedgerIssue(one.ledger, 'c')
    const stale = saveLedgerSettle(two.ledger, one.seq, 'b', false)
    expect(stale).toEqual({ ledger: two.ledger, latest: false })
    const last = saveLedgerSettle(two.ledger, two.seq, 'c', false)
    expect(last.latest).toBe(true)
    expect(last.ledger.stored).toBe('a')
    expect(last.ledger.inFlight).toBeNull()
  })
})

describe('revealChoiceCommit', () => {
  const now = new Date('2026-10-19T20:00:00Z')
  const later = new Date('2026-10-19T23:00:00Z')
  const earlier = new Date('2026-10-19T18:00:00Z')

  it('does nothing when the choice is the current one', () => {
    expect(
      revealChoiceCommit({
        from: 'instant',
        to: 'instant',
        revealAt: later,
        now,
      }),
    ).toBe('none')
  })

  it('asks first before opening an album that is still closed', () => {
    expect(
      revealChoiceCommit({
        from: 'event_end',
        to: 'instant',
        revealAt: later,
        now,
      }),
    ).toBe('confirm')
  })

  it('saves straight away once the album is already open', () => {
    expect(
      revealChoiceCommit({
        from: 'event_end',
        to: 'instant',
        revealAt: earlier,
        now,
      }),
    ).toBe('save')
    expect(
      revealChoiceCommit({
        from: 'event_end',
        to: 'instant',
        revealAt: now,
        now,
      }),
    ).toBe('save')
  })

  it('saves a move to the event end at once', () => {
    expect(
      revealChoiceCommit({
        from: 'instant',
        to: 'event_end',
        revealAt: later,
        now,
      }),
    ).toBe('save')
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

describe('paymentNotice', () => {
  it('is failed when the latest purchase failed', () => {
    expect(paymentNotice({ status: 'failed' }, false)).toBe('failed')
    expect(paymentNotice({ status: 'failed' }, true)).toBe('failed')
  })

  it('is cancelled on a cancelled return with no purchase', () => {
    expect(paymentNotice(null, true)).toBe('cancelled')
  })

  it('is cancelled on a cancelled return over an abandoned attempt', () => {
    expect(paymentNotice({ status: 'pending' }, true)).toBe('cancelled')
    expect(paymentNotice({ status: 'expired' }, true)).toBe('cancelled')
  })

  it('stays quiet once the event is paid, whatever the URL says', () => {
    expect(paymentNotice({ status: 'paid' }, true)).toBeNull()
  })

  it('stays quiet with no purchase and no return', () => {
    expect(paymentNotice(null, false)).toBeNull()
    expect(paymentNotice({ status: 'expired' }, false)).toBeNull()
  })
})
