import { describe, expect, it } from 'vitest'

import {
  planResume,
  reservationProgress,
  type ReservationProgress,
} from '@/lib/upload-resume'

const master = {
  compressed: true,
  blobSize: 2_200_000,
  width: 3200,
  height: 2400,
}
const raw = {
  compressed: false,
  blobSize: 8_000_000,
  width: null,
  height: null,
}

function pending(stored: Partial<ReservationProgress['stored']> = {}) {
  return {
    status: 'pending' as const,
    stored: { full: null, view: null, thumb: null, ...stored },
  }
}

describe('reading what the server reported', () => {
  it('is nothing at all from a server that does not say', () => {
    expect(reservationProgress({})).toBeNull()
    expect(reservationProgress({ photo_status: null })).toBeNull()
    expect(reservationProgress({ photo_status: 'archived' })).toBeNull()
  })

  it('treats an object with no size, or none, as not there', () => {
    expect(
      reservationProgress({
        photo_status: 'pending',
        full_bytes: 0,
        view_bytes: null,
        thumb_bytes: 4_000,
      }),
    ).toEqual({
      status: 'pending',
      stored: { full: null, view: null, thumb: 4_000 },
    })
  })
})

describe('what a retry still has to do', () => {
  it('starts from the beginning when the server said nothing', () => {
    expect(planResume(null, master)).toEqual({
      kind: 'upload',
      present: 0,
      renders: ['full', 'view', 'thumb'],
      decode: true,
      master: { width: 3200, height: 2400, byteSize: 2_200_000 },
    })
  })

  it('sends nothing for a row that is already ready', () => {
    expect(planResume({ ...pending(), status: 'ready' }, master)).toEqual({
      kind: 'committed',
    })
    // Whatever the device holds: the commit is the server's fact, not ours.
    expect(planResume({ ...pending(), status: 'ready' }, raw)).toEqual({
      kind: 'committed',
    })
  })

  it('goes straight to the commit when every render landed', () => {
    const progress = pending({ full: 2_200_000, view: 300_000, thumb: 30_000 })
    expect(planResume(progress, master)).toEqual({
      kind: 'commit',
      present: 3,
      master: { width: 3200, height: 2400, byteSize: 2_200_000 },
    })
  })

  it('sends only the master, without a decode, when the renders from it landed', () => {
    const progress = pending({ view: 300_000, thumb: 30_000 })
    expect(planResume(progress, master)).toMatchObject({
      kind: 'upload',
      present: 2,
      renders: ['full'],
      decode: false,
    })
  })

  it('decodes when a render derived from the master is missing', () => {
    const progress = pending({ full: 2_200_000, thumb: 30_000 })
    expect(planResume(progress, master)).toMatchObject({
      kind: 'upload',
      present: 2,
      renders: ['view'],
      decode: true,
    })
  })

  it('sends the master again when Storage holds a different one', () => {
    const progress = pending({ full: 999, view: 300_000, thumb: 30_000 })
    expect(planResume(progress, master)).toMatchObject({
      kind: 'upload',
      present: 2,
      renders: ['full'],
    })
  })

  it('trusts nothing in Storage for a raw row, whose next master differs', () => {
    const progress = pending({ full: 2_200_000, view: 300_000, thumb: 30_000 })
    expect(planResume(progress, raw)).toEqual({
      kind: 'upload',
      present: 0,
      renders: ['full', 'view', 'thumb'],
      decode: true,
      master: null,
    })
  })
})
