import { describe, expect, it } from 'vitest'
import { POST_EVENT_UPLOAD_MS, postEventUploadsAreOpen } from '@/lib/camera'

const end = new Date('2026-09-26T20:00:00Z')
const base = {
  enabled: true,
  captureEndAt: end,
  joinedAt: new Date(end.getTime() - 1),
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
  it('requires opt-in and an existing participant', () => {
    const now = new Date(end.getTime() + 1)
    expect(postEventUploadsAreOpen({ ...base, now, enabled: false })).toBe(
      false,
    )
    expect(postEventUploadsAreOpen({ ...base, now, joinedAt: null })).toBe(
      false,
    )
    expect(postEventUploadsAreOpen({ ...base, now, joinedAt: now })).toBe(false)
  })
})
