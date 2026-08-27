import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SHOTS,
  SHOT_OPTIONS,
  captureWindowState,
  guestGalleryIsOpen,
  isRevealChoice,
  isRevealMode,
  isShotOption,
  resolveRevealAt,
  validateEventDraft,
} from '@/lib/camera'

const start = new Date('2026-06-13T14:00:00Z')
const end = new Date('2026-06-13T22:00:00Z')

describe('shot options', () => {
  it('offers exactly the five documented rolls', () => {
    expect([...SHOT_OPTIONS]).toEqual([5, 10, 16, 24, 36])
  })

  it('defaults to 24', () => {
    expect(DEFAULT_SHOTS).toBe(24)
  })

  it('rejects anything outside the five', () => {
    // The same set the check constraint on events.shots_per_participant
    // enforces. There is deliberately no unlimited option.
    for (const bad of [0, 1, 4, 6, 25, 37, 100, Infinity, NaN, -5]) {
      expect(isShotOption(bad)).toBe(false)
    }
    for (const good of SHOT_OPTIONS) expect(isShotOption(good)).toBe(true)
  })

  it('rejects non-numbers arriving from a form', () => {
    for (const bad of ['24', null, undefined, {}, []]) {
      expect(isShotOption(bad)).toBe(false)
    }
  })
})

describe('resolveRevealAt', () => {
  it('opens with the camera in instant mode', () => {
    expect(
      resolveRevealAt({
        mode: 'instant',
        captureStartAt: start,
        captureEndAt: end,
        customRevealAt: null,
      }),
    ).toEqual(start)
  })

  it('opens when the camera closes in event_end mode', () => {
    expect(
      resolveRevealAt({
        mode: 'event_end',
        captureStartAt: start,
        captureEndAt: end,
        customRevealAt: null,
      }),
    ).toEqual(end)
  })

  it('uses the chosen moment in custom mode', () => {
    const later = new Date('2026-06-20T18:00:00Z')
    expect(
      resolveRevealAt({
        mode: 'custom',
        captureStartAt: start,
        captureEndAt: end,
        customRevealAt: later,
      }),
    ).toEqual(later)
  })

  it('falls back to the capture end when custom names no moment', () => {
    expect(
      resolveRevealAt({
        mode: 'custom',
        captureStartAt: start,
        captureEndAt: end,
        customRevealAt: null,
      }),
    ).toEqual(end)
  })

  it('ignores a custom moment in the two pinned modes', () => {
    const stray = new Date('2027-01-01T00:00:00Z')
    expect(
      resolveRevealAt({
        mode: 'instant',
        captureStartAt: start,
        captureEndAt: end,
        customRevealAt: stray,
      }),
    ).toEqual(start)
    expect(
      resolveRevealAt({
        mode: 'event_end',
        captureStartAt: start,
        captureEndAt: end,
        customRevealAt: stray,
      }),
    ).toEqual(end)
  })

  it('recognises the three modes and nothing else', () => {
    for (const mode of ['instant', 'event_end', 'custom']) {
      expect(isRevealMode(mode)).toBe(true)
    }
    // 'legacy_album' in particular: the pivot has no legacy mode, and a stray
    // value must not resolve to one by accident.
    for (const bad of ['later', 'legacy_album', '', null, 24]) {
      expect(isRevealMode(bad)).toBe(false)
    }
  })

  it('offers only instant and event-end as product choices', () => {
    expect(isRevealChoice('instant')).toBe(true)
    expect(isRevealChoice('event_end')).toBe(true)
    expect(isRevealChoice('custom')).toBe(false)
    expect(isRevealChoice('later')).toBe(false)
  })
})

describe('captureWindowState', () => {
  it('is closed before the camera opens', () => {
    expect(
      captureWindowState({
        now: new Date('2026-06-13T13:59:59Z'),
        captureStartAt: start,
        captureEndAt: end,
      }),
    ).toBe('before')
  })

  it('is open between the two instants', () => {
    expect(
      captureWindowState({
        now: new Date('2026-06-13T18:00:00Z'),
        captureStartAt: start,
        captureEndAt: end,
      }),
    ).toBe('open')
  })

  it('is closed after the camera stops', () => {
    expect(
      captureWindowState({
        now: new Date('2026-06-13T22:00:01Z'),
        captureStartAt: start,
        captureEndAt: end,
      }),
    ).toBe('after')
  })

  it('includes both boundaries', () => {
    // Matches `now() >= start and now() <= end` in reserve_shot. A guest who
    // taps at exactly the advertised start time must not be refused.
    expect(
      captureWindowState({
        now: start,
        captureStartAt: start,
        captureEndAt: end,
      }),
    ).toBe('open')
    expect(
      captureWindowState({
        now: end,
        captureStartAt: start,
        captureEndAt: end,
      }),
    ).toBe('open')
  })
})

describe('guestGalleryIsOpen', () => {
  const revealAt = new Date('2026-06-13T22:00:00Z')

  it('stays shut before the reveal', () => {
    expect(
      guestGalleryIsOpen({
        now: new Date('2026-06-13T21:59:59Z'),
        revealAt,
        guestsCanView: true,
      }),
    ).toBe(false)
  })

  it('opens at the reveal', () => {
    expect(
      guestGalleryIsOpen({ now: revealAt, revealAt, guestsCanView: true }),
    ).toBe(true)
  })

  it('stays shut after the reveal when the host disabled guest access', () => {
    // Both conditions are the host's, and this is the one that survives the
    // reveal: the album develops, the organizer sees it, the guests do not.
    expect(
      guestGalleryIsOpen({
        now: new Date('2026-07-01T00:00:00Z'),
        revealAt,
        guestsCanView: false,
      }),
    ).toBe(false)
  })
})

describe('validateEventDraft', () => {
  const valid = {
    name: 'Anna és Bence esküvője',
    captureStartAt: start,
    captureEndAt: end,
    revealMode: 'event_end' as const,
    customRevealAt: null,
    shotsPerParticipant: 24,
  }

  it('accepts a well-formed draft', () => {
    expect(validateEventDraft(valid)).toEqual([])
  })

  it('requires a name', () => {
    expect(validateEventDraft({ ...valid, name: '   ' })).toContain(
      'name_required',
    )
  })

  it('refuses a capture end at or before the start', () => {
    expect(validateEventDraft({ ...valid, captureEndAt: start })).toContain(
      'window_backwards',
    )
    expect(
      validateEventDraft({
        ...valid,
        captureEndAt: new Date('2026-06-13T13:00:00Z'),
      }),
    ).toContain('window_backwards')
  })

  it('refuses a custom reveal before the capture end', () => {
    expect(
      validateEventDraft({
        ...valid,
        revealMode: 'custom',
        customRevealAt: new Date('2026-06-13T21:00:00Z'),
      }),
    ).toContain('reveal_before_end')
  })

  it('accepts a custom reveal exactly at the capture end', () => {
    expect(
      validateEventDraft({
        ...valid,
        revealMode: 'custom',
        customRevealAt: end,
      }),
    ).toEqual([])
  })

  it('refuses a custom mode with no moment chosen', () => {
    expect(
      validateEventDraft({
        ...valid,
        revealMode: 'custom',
        customRevealAt: null,
      }),
    ).toContain('reveal_before_end')
  })

  it('never complains about reveal timing in the two pinned modes', () => {
    for (const mode of ['instant', 'event_end'] as const) {
      expect(
        validateEventDraft({
          ...valid,
          revealMode: mode,
          customRevealAt: null,
        }),
      ).toEqual([])
    }
  })

  it('refuses a shot count outside the five', () => {
    expect(validateEventDraft({ ...valid, shotsPerParticipant: 30 })).toContain(
      'invalid_shots',
    )
  })

  it('reports every problem at once', () => {
    // The wizard shows each error against the step it belongs to, so a
    // first-error-only API would walk a host back and forth.
    const errors = validateEventDraft({
      name: '',
      captureStartAt: end,
      captureEndAt: start,
      revealMode: 'custom',
      customRevealAt: null,
      shotsPerParticipant: 7,
    })
    expect(errors).toContain('name_required')
    expect(errors).toContain('window_backwards')
    expect(errors).toContain('invalid_shots')
  })
})
