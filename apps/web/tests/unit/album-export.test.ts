import { beforeAll, describe, expect, it } from 'vitest'

import {
  BROWSER_EXPORT_MAX_BYTES,
  BROWSER_EXPORT_MAX_PHOTOS,
  buildExportManifest,
  chooseExportMode,
  wallClockToDate,
} from '@/lib/album-export'
import { exifDateSegment, exifDateSegmentFrom } from '@/lib/exif-write'
import {
  eventStamp,
  eventUtcOffset,
  eventWallClock,
  eventWallClockNaive,
} from '@/lib/format'

/**
 * The export manifest: the one description of an album archive that every
 * zipper — the browser, the streaming route, the worker to come — starts
 * from. Names are pinned by `archive-naming.test.ts`; this file pins the
 * rest: which path an album takes, what an entry carries, and that the two
 * things that cross a process boundary (the wall clock and the EXIF stamp)
 * come back out unchanged.
 */

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'anon'
})

const MB = 1024 * 1024

function photos(count: number, byteSize: number | null) {
  return Array.from({ length: count }, () => ({ byte_size: byteSize }))
}

describe('chooseExportMode', () => {
  it('zips in the browser up to the count', () => {
    expect(chooseExportMode(photos(BROWSER_EXPORT_MAX_PHOTOS, 2 * MB))).toBe(
      'browser',
    )
    expect(
      chooseExportMode(photos(BROWSER_EXPORT_MAX_PHOTOS + 1, 2 * MB)),
    ).toBe('prepared')
  })

  it('routes a small album of heavy masters to the prepared path', () => {
    // Twenty 4MB masters — an event from before the 3200px policy — is the
    // same blob that fails on a phone, whatever the count says.
    expect(chooseExportMode(photos(20, 4 * MB))).toBe('prepared')
    expect(chooseExportMode(photos(10, 4 * MB))).toBe('browser')
  })

  it('assumes a size for rows that predate byte_size', () => {
    expect(chooseExportMode(photos(5, null))).toBe('browser')
    // Twenty unknowns at the assumed 3MB sit exactly on the byte limit and
    // still qualify; one more byte anywhere would not.
    expect(chooseExportMode(photos(20, null))).toBe('browser')
    expect(
      chooseExportMode([
        ...photos(19, null),
        { byte_size: BROWSER_EXPORT_MAX_BYTES - 19 * 3 * MB + 1 },
      ]),
    ).toBe('prepared')
  })
})

describe('buildExportManifest', () => {
  const event = { id: 'ev', slug: 'k3f9x7ab2m', time_zone: 'Europe/Budapest' }

  it('carries everything a zipper needs and nothing it does not', () => {
    const manifest = buildExportManifest(event, [
      {
        id: 'p1',
        storage_path: 'ev/p1.jpg',
        taken_at: '2026-06-14T16:00:00Z',
        created_at: '2026-06-14T16:00:30Z',
        hidden_at: null,
        uploaderName: 'Anna',
      },
      {
        id: 'p2',
        storage_path: 'ev/p2.jpg',
        taken_at: null,
        created_at: '2026-06-14T17:00:00Z',
        hidden_at: '2026-06-15T09:00:00Z',
        uploaderName: null,
      },
    ])

    expect(manifest.eventId).toBe('ev')
    expect(manifest.filename).toBe('k3f9x7ab2m-ourfilm.zip')
    expect(manifest.entries).toEqual([
      {
        id: 'p1',
        url: 'https://example.supabase.co/storage/v1/object/public/event-photos/ev/p1.jpg',
        name: '001-2026-06-14_1800-Anna.jpg',
        lastModified: '2026-06-14T18:00:00',
        exif: { stamp: '2026:06:14 18:00:00', offset: '+02:00' },
      },
      {
        id: 'p2',
        url: 'https://example.supabase.co/storage/v1/object/public/event-photos/ev/p2.jpg',
        name: 'rejtett/002.jpg',
        lastModified: '2026-06-14T19:00:00',
        exif: null,
      },
    ])
    // No storage path, no uploader name, no zone: a consumer holding the
    // manifest learns nothing about the bucket's layout or the guests.
    for (const entry of manifest.entries) {
      expect(Object.keys(entry).sort()).toEqual([
        'exif',
        'id',
        'lastModified',
        'name',
        'url',
      ])
    }
  })
})

describe('what crosses the process boundary', () => {
  it('round-trips the wall clock through a naive string', () => {
    for (const iso of ['2026-06-14T16:00:00Z', '2026-12-24T17:30:00Z']) {
      const naive = eventWallClockNaive(iso, 'Europe/Budapest')
      expect(wallClockToDate(naive).getTime()).toBe(
        eventWallClock(iso, 'Europe/Budapest').getTime(),
      )
    }
  })

  it('refuses anything that is not a naive timestamp', () => {
    expect(() => wallClockToDate('2026-06-14T16:00:00Z')).toThrow()
    expect(() => wallClockToDate('2026-06-14')).toThrow()
  })

  it('splices the same EXIF bytes from a pre-rendered stamp', () => {
    const iso = '2026-08-15T12:32:10Z'
    const direct = exifDateSegment(iso, 'Europe/Budapest')
    const split = exifDateSegmentFrom(
      eventStamp(iso, 'Europe/Budapest'),
      eventUtcOffset(iso, 'Europe/Budapest'),
    )
    expect(Array.from(split)).toEqual(Array.from(direct))
  })
})
