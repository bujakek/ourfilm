import { describe, expect, it } from 'vitest'
import { POST_EVENT_UPLOAD_MS, postEventUploadsAreOpen } from '@/lib/camera'
import { joinStateLabel } from '@/lib/event-copy'

const end = new Date('2026-09-26T20:00:00Z')
const base = {
  enabled: true,
  captureEndAt: end,
}
describe('post-event upload display window', () => {
  it.each([
    [-1, false],
    [0, false],
    [1, true],
    [POST_EVENT_UPLOAD_MS - 1, true],
    [POST_EVENT_UPLOAD_MS, false],
    [POST_EVENT_UPLOAD_MS + 1, false],
  ])('matches the server at end plus %s milliseconds', (offset, expected) => {
    expect(
      postEventUploadsAreOpen({
        ...base,
        now: new Date(end.getTime() + offset),
      }),
    ).toBe(expected)
  })
  it('requires the host to opt in', () => {
    const now = new Date(end.getTime() + 1)
    expect(postEventUploadsAreOpen({ ...base, now, enabled: false })).toBe(
      false,
    )
  })
})

describe('join screen status line after the close', () => {
  const timing = (offset: number) => ({
    now: new Date(end.getTime() + offset),
    captureStartAt: new Date(end.getTime() - 6 * 3600_000),
    captureEndAt: end,
    revealAt: end,
    guestsCanView: true,
    timeZone: 'Europe/Budapest',
  })
  it('names the upload window while it is open', () => {
    expect(joinStateLabel(timing(1), 10, 'en', true)).toMatch(
      /^Shooting has ended\. You can still add photos from your phone until .+\.$/,
    )
    expect(joinStateLabel(timing(1), 10, 'hu', true)).toMatch(
      /^A fotózás véget ért\. .+-ig még hozzáadhatsz képeket a telefonodról\.$/,
    )
  })
  it('says only that shooting ended when the option is off or the window is over', () => {
    expect(joinStateLabel(timing(1), 10, 'en', false)).toBe(
      'Shooting has ended.',
    )
    expect(joinStateLabel(timing(POST_EVENT_UPLOAD_MS), 10, 'en', true)).toBe(
      'Shooting has ended.',
    )
  })
})
