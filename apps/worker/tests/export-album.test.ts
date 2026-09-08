import { readFileSync, rmSync, mkdtempSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  MISSING_PHOTOS_ENTRY,
  type ExportJob,
} from '@ourfilm/shared/export-job'

import { hasRoomFor } from '../src/disk.ts'
import { buildArchive } from '../src/export-album.ts'

/**
 * The worker's archive, assembled from a fake bucket.
 *
 * A tiny HTTP server stands in for Supabase's public object route; the
 * manifest points at it. What this pins: entries land in manifest order, the
 * EXIF splice is applied where the manifest says and nowhere else, a master
 * that 404s is skipped and named in the note rather than failing the job, and
 * the result is a ZIP another tool can open — the central directory is read
 * by hand rather than trusted.
 */

// The env module is read lazily, so the loop's settings never matter here;
// only the required names have to exist.
process.env.OURFILM_API_URL ??= 'http://127.0.0.1:0'
process.env.EXPORT_WORKER_SECRET ??= 'test'

/** SOI, one DQT segment with two bytes of payload, SOS, three scan bytes, EOI.
 *  The smallest header the splice recognises as a JPEG it may rewrite. */
const JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xdb, 0x00, 0x04, 0x11, 0x22, 0xff, 0xda, 0x00, 0x02, 0x01,
  0x02, 0x03, 0xff, 0xd9,
])

let server: Server
let base: string
let dir: string

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/a.jpg' || req.url === '/b.jpg') {
      res.writeHead(200, { 'content-type': 'image/jpeg' })
      res.end(JPEG)
    } else {
      res.writeHead(404)
      res.end()
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  dir = mkdtempSync(join(tmpdir(), 'ourfilm-worker-test-'))
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  rmSync(dir, { recursive: true, force: true })
})

function job(): ExportJob {
  return {
    exportId: 'export-1',
    estimatedBytes: 3 * JPEG.length,
    leaseSeconds: 600,
    heartbeatSeconds: 60,
    upload: {
      endpoint: `${base}/upload`,
      apikey: 'anon',
      token: 'token',
      bucket: 'event-exports',
      objectPath: 'ev/export-1/ourfilm.zip',
      existingUploadUrl: null,
    },
    manifest: {
      eventId: 'ev',
      filename: 'k3f9x7ab2m-ourfilm.zip',
      entries: [
        {
          id: 'p1',
          url: `${base}/a.jpg`,
          name: '001-2026-06-14_1800-Anna.jpg',
          lastModified: '2026-06-14T18:00:00',
          exif: { stamp: '2026:06:14 18:00:00', offset: '+02:00' },
        },
        {
          id: 'p2',
          url: `${base}/b.jpg`,
          name: 'rejtett/002-Bence.jpg',
          lastModified: '2026-06-14T18:05:00',
          exif: null,
        },
        {
          id: 'p3',
          url: `${base}/missing.jpg`,
          name: '003-Csilla.jpg',
          lastModified: '2026-06-14T18:10:00',
          exif: null,
        },
      ],
    },
  }
}

type ZipEntry = { name: string; data: Buffer }

/** Walk the central directory. Sizes come from there, not from the local
 *  headers: archiver streams entries and writes their sizes in a trailing
 *  data descriptor, so the local header says zero. */
function readZip(file: string): ZipEntry[] {
  const buf = readFileSync(file)
  let eocd = -1
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  expect(eocd).toBeGreaterThan(0)
  const count = buf.readUInt16LE(eocd + 10)
  let at = buf.readUInt32LE(eocd + 16)
  const entries: ZipEntry[] = []
  for (let i = 0; i < count; i++) {
    expect(buf.readUInt32LE(at)).toBe(0x02014b50)
    const compressedSize = buf.readUInt32LE(at + 20)
    const nameLength = buf.readUInt16LE(at + 28)
    const extraLength = buf.readUInt16LE(at + 30)
    const commentLength = buf.readUInt16LE(at + 32)
    const localOffset = buf.readUInt32LE(at + 42)
    const name = buf.subarray(at + 46, at + 46 + nameLength).toString('utf8')

    expect(buf.readUInt32LE(localOffset)).toBe(0x04034b50)
    const localName = buf.readUInt16LE(localOffset + 26)
    const localExtra = buf.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localName + localExtra
    entries.push({
      name,
      data: buf.subarray(dataStart, dataStart + compressedSize),
    })
    at += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

describe('buildArchive', () => {
  it('assembles the manifest in order, splices where told, and names the gap', async () => {
    const file = join(dir, 'out.zip')
    const progress: number[] = []
    const result = await buildArchive(job(), file, {
      concurrency: 2,
      onEntry: (done) => progress.push(done),
    })

    expect(result.missing).toEqual(['003-Csilla.jpg'])
    expect(progress).toEqual([1, 2, 3])
    expect(result.bytes).toBe(readFileSync(file).length)

    const entries = readZip(file)
    expect(entries.map((e) => e.name)).toEqual([
      '001-2026-06-14_1800-Anna.jpg',
      'rejtett/002-Bence.jpg',
      MISSING_PHOTOS_ENTRY,
    ])

    // The spliced entry gained an APP1 straight after SOI; the untouched one
    // is byte-for-byte the served file.
    const [spliced, plain, note] = entries
    expect(Array.from(spliced!.data.subarray(0, 4))).toEqual([
      0xff, 0xd8, 0xff, 0xe1,
    ])
    expect(spliced!.data.length).toBeGreaterThan(JPEG.length)
    expect(spliced!.data.subarray(-6)).toEqual(JPEG.subarray(-6))
    expect(Buffer.compare(plain!.data, JPEG)).toBe(0)
    expect(note!.data.toString('utf8')).toContain('003-Csilla.jpg')
  })
})

describe('hasRoomFor', () => {
  it('keeps the floor free, not just the job', async () => {
    const gib = 1024 ** 3
    const free = async () => 10 * gib
    expect(await hasRoomFor(7 * gib, free, 2 * gib, '/x')).toBe(true)
    expect(await hasRoomFor(8 * gib, free, 2 * gib, '/x')).toBe(false)
    expect(await hasRoomFor(9 * gib, free, 2 * gib, '/x')).toBe(false)
  })
})
