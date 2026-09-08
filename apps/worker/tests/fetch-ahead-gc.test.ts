import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import v8 from 'node:v8'
import vm from 'node:vm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { ExportJob } from '@ourfilm/shared/export-job'

import { buildArchive } from '../src/export-album.ts'

/**
 * The bug that shipped 21 empty photos in the first real export.
 *
 * Node's fetch registers every `Response` in a FinalizationRegistry that
 * cancels the body if the object is garbage collected while the body is
 * unread (undici, `lib/web/fetch/response.js`). The fetch-ahead window holds
 * several unread bodies for seconds while a large entry streams, which is
 * exactly when a collection runs. The first version kept only `response.body`
 * and let the `Response` go; the bodies closed with zero bytes, archiver wrote
 * zero-byte entries, and nothing reported anything.
 *
 * This test recreates the condition: a slow first entry so the others sit in
 * the window, and a forced collection while they wait; `gc` is obtained
 * through V8's flag API so the runner needs no special arguments. Two things
 * are pinned — that every entry still carries its bytes, and that a body
 * which *does* arrive short fails the job rather than shipping.
 */

v8.setFlagsFromString('--expose-gc')
const gc = vm.runInNewContext('gc') as () => void

process.env.OURFILM_API_URL ??= 'http://127.0.0.1:0'
process.env.EXPORT_WORKER_SECRET ??= 'test'

const JPEG_HEAD = Buffer.from([
  0xff, 0xd8, 0xff, 0xdb, 0x00, 0x04, 0x11, 0x22, 0xff, 0xda, 0x00, 0x02,
])
/** A ~200KB "photo": a real header, then padding, then EOI. */
const PHOTO = Buffer.concat([
  JPEG_HEAD,
  Buffer.alloc(200 * 1024, 0x42),
  Buffer.from([0xff, 0xd9]),
])

let server: Server
let base: string
let dir: string

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/slow.jpg') {
      // Dripped out over ~300ms so the rest of the window is left waiting.
      res.writeHead(200, {
        'content-type': 'image/jpeg',
        'content-length': String(PHOTO.length),
      })
      let at = 0
      const step = () => {
        const end = Math.min(at + 16 * 1024, PHOTO.length)
        res.write(PHOTO.subarray(at, end))
        at = end
        if (at < PHOTO.length) setTimeout(step, 20)
        else res.end()
      }
      step()
      return
    }
    if (req.url === '/short.jpg') {
      // Claims the full length, sends half, and drops the connection once
      // that half has left — a truncated body, not a failed request.
      res.writeHead(200, {
        'content-type': 'image/jpeg',
        'content-length': String(PHOTO.length),
      })
      res.write(PHOTO.subarray(0, PHOTO.length >> 1), () =>
        setTimeout(() => res.destroy(), 50),
      )
      return
    }
    res.writeHead(200, {
      'content-type': 'image/jpeg',
      'content-length': String(PHOTO.length),
    })
    res.end(PHOTO)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  dir = mkdtempSync(join(tmpdir(), 'ourfilm-worker-gc-'))
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  rmSync(dir, { recursive: true, force: true })
})

function job(names: string[]): ExportJob {
  return {
    exportId: 'export-gc',
    estimatedBytes: names.length * PHOTO.length,
    leaseSeconds: 600,
    heartbeatSeconds: 60,
    upload: {
      endpoint: `${base}/upload`,
      apikey: 'anon',
      token: 'token',
      bucket: 'event-exports',
      objectPath: 'ev/export-gc/ourfilm.zip',
      existingUploadUrl: null,
    },
    manifest: {
      eventId: 'ev',
      filename: 'gc-ourfilm.zip',
      entries: names.map((file, i) => ({
        id: `p${i}`,
        url: `${base}/${file}`,
        name: `${String(i + 1).padStart(3, '0')}-Vendeg.jpg`,
        lastModified: '2026-06-14T18:00:00',
        exif: null,
      })),
    },
  }
}

/** Entry sizes from the central directory, in order. */
function entrySizes(file: string): number[] {
  const buf = readFileSync(file)
  let eocd = -1
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  const count = buf.readUInt16LE(eocd + 10)
  let at = buf.readUInt32LE(eocd + 16)
  const sizes: number[] = []
  for (let i = 0; i < count; i++) {
    sizes.push(buf.readUInt32LE(at + 20))
    const nameLength = buf.readUInt16LE(at + 28)
    const extraLength = buf.readUInt16LE(at + 30)
    const commentLength = buf.readUInt16LE(at + 32)
    at += 46 + nameLength + extraLength + commentLength
  }
  return sizes
}

describe('the fetch-ahead window under garbage collection', () => {
  it('keeps every waiting body alive until it is written', async () => {
    expect(typeof gc).toBe('function')
    const names = ['slow.jpg', ...Array.from({ length: 11 }, () => 'a.jpg')]
    const file = join(dir, 'gc.zip')

    // Collect aggressively for the whole build. The finalizer that cancels an
    // unreferenced Response's body runs on a later tick, which the timer's
    // cadence gives it.
    const collector = setInterval(() => gc(), 10)
    try {
      const result = await buildArchive(job(names), file, { concurrency: 8 })
      expect(result.missing).toEqual([])
    } finally {
      clearInterval(collector)
    }

    const sizes = entrySizes(file)
    expect(sizes).toHaveLength(names.length)
    expect(sizes.every((size) => size === PHOTO.length)).toBe(true)
  })

  it('fails the job on a body that arrives short, rather than shipping it', async () => {
    const file = join(dir, 'short.zip')
    await expect(
      buildArchive(job(['a.jpg', 'short.jpg', 'a.jpg']), file, {
        concurrency: 2,
      }),
    ).rejects.toMatchObject({ code: 'fetch_failed', retry: true })
  })
})
