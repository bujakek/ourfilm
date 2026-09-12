import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { photoRef } from '@/lib/photo-ref'
import { safeServerValue } from '@/lib/telemetry-server'

const PHOTO = 'b359f2dd-9a07-4653-8c3b-78c5e2cfdce5'

describe('a photo in analytics', () => {
  it('is the sha-256 an operator can compute from the id', async () => {
    // `printf %s <id> | shasum -a 256` must find the same reports.
    expect(await photoRef(PHOTO)).toBe(
      createHash('sha256').update(PHOTO).digest('hex'),
    )
    expect(await photoRef(PHOTO.toUpperCase())).toBe(await photoRef(PHOTO))
  })

  it('is nothing at all for a value that is not a photo id', async () => {
    expect(await photoRef('k3f9x7ab2m')).toBeNull()
    expect(await photoRef('')).toBeNull()
    expect(await photoRef(null)).toBeNull()
  })
})

describe('server event identifiers', () => {
  it('accept a reference only as a sha-256 in hex', () => {
    const ref = createHash('sha256').update(PHOTO).digest('hex')
    expect(safeServerValue('photo_ref', ref)).toBe(ref)
    // The raw id is exactly what the reference exists to keep out.
    expect(safeServerValue('photo_ref', PHOTO)).toBeNull()
    expect(safeServerValue('photo_ref', ref.toUpperCase())).toBeNull()
  })

  it('treat every *_id field as a uuid or nothing', () => {
    const id = '0b6f3c5e-6a0e-4d7e-9a53-3c1f1d2e4b5a'
    expect(safeServerValue('attempt_id', id)).toBe(id)
    expect(safeServerValue('claimed_capture_id', id)).toBe(id)
    expect(safeServerValue('attempt_id', 'unavailable')).toBeNull()
    expect(safeServerValue('capture_id', 'Anna Kovács')).toBeNull()
  })
})
