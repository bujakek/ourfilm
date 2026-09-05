/**
 *     pnpm test
 *
 * The queue is a factory with I/O injected. The store underneath is the real
 * `lib/upload-store.ts` over `fake-indexeddb`.
 */
import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PreparedPhoto } from '@/lib/image'
import {
  createUploadQueue,
  MAX_AGE_MS,
  MAX_ATTEMPTS,
  REQUEST_TIMEOUTS_MS,
  RETRY_MS,
  type UploadQueueDeps,
  type UploadQueueHandlers,
} from '@/lib/upload-queue'
import {
  uploadStore,
  __resetForTests,
  type StoredShot,
} from '@/lib/upload-store'

const EVENT = '11111111-1111-4111-8111-111111111111'
const NOW = 1_700_000_000_000

const prepared: PreparedPhoto = {
  full: new Blob([new Uint8Array(64)], { type: 'image/jpeg' }),
  view: new Blob([new Uint8Array(16)], { type: 'image/jpeg' }),
  thumb: new Blob([new Uint8Array(4)], { type: 'image/jpeg' }),
  width: 4032,
  height: 3024,
  takenAt: new Date('2026-08-15T14:32:10.000Z'),
}

const signed = (path: string) => ({ path, token: 'signed' })

/** What `compressForStorage` hands back: the master, and the two things the
 *  canvas is about to destroy. */
const master = {
  blob: new Blob([new Uint8Array(64)], { type: 'image/jpeg' }),
  width: 4032,
  height: 3024,
  takenAt: new Date('2026-08-15T14:32:10.000Z'),
}

function reserved(photoId: string, shotsRemaining = 23) {
  return {
    ok: true as const,
    photoId,
    shotsRemaining,
    uploads: {
      full: signed(`${EVENT}/${photoId}.jpg`),
      view: signed(`${EVENT}/${photoId}_view.jpg`),
      thumb: signed(`${EVENT}/${photoId}_thumb.jpg`),
    },
  }
}

function file(name = 'IMG_0001.JPG') {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xdb])], name, {
    type: 'image/jpeg',
    lastModified: NOW,
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function hang<T>() {
  return new Promise<T>(() => undefined)
}

type Sweep = {
  run: () => void
  delayMs: number
  cancelled: boolean
  fired: boolean
}

type Harness = {
  deps: UploadQueueDeps
  handlers: UploadQueueHandlers
  now: { value: number }
  sweeps: Sweep[]
}

function armed(h: Harness) {
  return h.sweeps.find((s) => !s.cancelled && !s.fired)
}

function harness(overrides: Partial<UploadQueueDeps> = {}): Harness {
  const now = { value: NOW }
  const sweeps: Sweep[] = []
  const deps: UploadQueueDeps = {
    reserve: vi.fn(async () => reserved(crypto.randomUUID())),
    compress: vi.fn(async () => master),
    prepare: vi.fn(async () => prepared),
    upload: vi.fn(async () => undefined),
    commit: vi.fn(async () => ({ committed: true, shotsRemaining: 23 })),
    release: vi.fn(async () => undefined),
    store: uploadStore,
    now: () => now.value,
    schedule: (run, delayMs) => {
      const sweep: Sweep = {
        delayMs,
        cancelled: false,
        fired: false,
        run: () => {
          sweep.fired = true
          run()
        },
      }
      sweeps.push(sweep)
      return () => {
        sweep.cancelled = true
      }
    },
    ...overrides,
  }
  const handlers: UploadQueueHandlers = {
    onReserved: vi.fn(),
    onProgress: vi.fn(),
    onConfirmed: vi.fn(),
    onDropped: vi.fn(),
    onRefusal: vi.fn(),
    onIssue: vi.fn(),
    onPrepared: vi.fn(),
    onDiscarded: vi.fn(),
    onRestored: vi.fn(),
  }
  return { deps, handlers, now, sweeps }
}

function queueFor(h: Harness) {
  return createUploadQueue({
    eventId: EVENT,
    deps: h.deps,
    handlers: h.handlers,
  })
}

async function orphan(overrides: Partial<StoredShot> = {}) {
  const row: StoredShot = {
    id: crypto.randomUUID(),
    eventId: EVENT,
    blob: new Blob([new Uint8Array([0xff, 0xd8])], { type: 'image/jpeg' }),
    name: 'IMG_0001.JPG',
    type: 'image/jpeg',
    lastModified: NOW,
    capturedAt: NOW,
    attempts: 0,
    compressed: true,
    takenAt: null,
    width: 4032,
    height: 3024,
    ...overrides,
  }
  await uploadStore.put(row)
  return row
}

async function until(condition: () => boolean | Promise<boolean>) {
  for (let i = 0; i < 500; i++) {
    if (await condition()) return
    await new Promise((resolve) => setTimeout(resolve, 1))
  }
  throw new Error('Timed out waiting for the queue to reach the expected state')
}

function called(fn: unknown) {
  return (fn as ReturnType<typeof vi.fn>).mock.calls.length
}

async function stored() {
  return (await uploadStore.listByEvent(EVENT)).map((row) => row.id)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  await __resetForTests()
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase('ourfilm-uploads')
    request.onsuccess = request.onerror = request.onblocked = () => resolve()
  })
})

describe('a shot the guest has just taken', () => {
  it('is durable before the first server call has even answered', async () => {
    const hold = deferred<ReturnType<typeof reserved>>()
    const h = harness({ reserve: vi.fn(() => hold.promise) })
    const q = queueFor(h)

    q.enqueue('shot-1', file(), NOW)
    await until(() => stored().then((ids) => ids.includes('shot-1')))

    expect(await stored()).toEqual(['shot-1'])
    hold.resolve(reserved('photo-1'))
    await q.drain()
    expect(await stored()).toEqual([])
  })

  it('is forgotten only once the server has confirmed it', async () => {
    const h = harness()
    const q = queueFor(h)
    q.enqueue('shot-1', file(), NOW)
    await q.drain()

    expect(h.handlers.onConfirmed).toHaveBeenCalledWith('shot-1', 23)
    expect(await stored()).toEqual([])
  })

  it('uploads one at a time, in the order shot', async () => {
    const h = harness()
    const q = queueFor(h)
    q.enqueue('a', file('a.jpg'), NOW)
    q.enqueue('b', file('b.jpg'), NOW + 1)
    await q.drain()

    expect(
      (h.deps.reserve as ReturnType<typeof vi.fn>).mock.calls.map(
        (call) => call[0],
      ),
    ).toEqual(['a', 'b'])
    expect(h.handlers.onConfirmed).toHaveBeenCalledTimes(2)
  })
})

describe('a refusal', () => {
  it('drops the rest of the roll when shooting has ended', async () => {
    const h = harness({
      reserve: vi.fn(async () => ({
        ok: false as const,
        refusal: 'ended' as const,
      })),
    })
    const q = queueFor(h)
    q.enqueue('a', file(), NOW)
    q.enqueue('b', file(), NOW + 1)
    await q.drain()

    expect(h.handlers.onDropped).toHaveBeenCalledWith('a', 'refused')
    expect(h.handlers.onDropped).toHaveBeenCalledWith('b', 'refused')
    expect(h.handlers.onRefusal).toHaveBeenCalledWith('ended')
    expect(await stored()).toEqual([])
  })

  it('keeps bytes for a gate that can lift', async () => {
    const h = harness({
      reserve: vi.fn(async () => ({
        ok: false as const,
        refusal: 'uploads_disabled' as const,
      })),
    })
    const q = queueFor(h)
    q.enqueue('shot-1', file(), NOW)
    await q.drain()

    expect(await stored()).toEqual(['shot-1'])
    expect(h.handlers.onDropped).not.toHaveBeenCalled()
    expect(h.handlers.onRefusal).toHaveBeenCalledWith('uploads_disabled')
    expect(armed(h)?.delayMs).toBe(RETRY_MS)
  })
})

describe('a tab that died mid-upload', () => {
  it('picks the roll back up, oldest first, and finishes it', async () => {
    const older = await orphan({ id: 'older', capturedAt: NOW - 1000 })
    const newer = await orphan({ id: 'newer', capturedAt: NOW })
    const keys: string[] = []
    const h = harness({
      reserve: vi.fn(async (key) => {
        keys.push(key)
        return reserved(crypto.randomUUID())
      }),
    })
    const q = queueFor(h)
    await q.resume()
    await q.drain()

    expect(keys).toEqual(['older', 'newer'])
    expect(h.handlers.onRestored).toHaveBeenCalledTimes(2)
    expect(await stored()).toEqual([])
    expect(older.id).toBe('older')
    expect(newer.id).toBe('newer')
  })

  it('hands a resumed shot back the same frame rather than a second one', async () => {
    await orphan({ id: 'same-key' })
    const h = harness()
    const q = queueFor(h)
    await q.resume()
    await q.drain()

    expect(h.deps.reserve).toHaveBeenCalledWith('same-key')
  })

  it('does not restore a shot that is still in flight', async () => {
    const hold = deferred<ReturnType<typeof reserved>>()
    const h = harness({ reserve: vi.fn(() => hold.promise) })
    const q = queueFor(h)
    q.enqueue('shot-1', file(), NOW)
    await until(() => called(h.deps.reserve) === 1)

    await q.resume()
    expect(h.handlers.onRestored).not.toHaveBeenCalled()

    hold.resolve(reserved('photo-1'))
    await q.drain()
  })
})

describe('giving up', () => {
  it('stops retrying a shot that has had its attempts', async () => {
    const h = harness({
      upload: vi.fn(async () => {
        throw new Error('storage 500')
      }),
    })
    const q = queueFor(h)
    q.enqueue('unlucky', file(), NOW)
    await q.drain()

    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      armed(h)?.run()
      await q.drain()
    }

    expect(h.handlers.onDropped).toHaveBeenCalledWith('unlucky', 'exhausted')
    expect(h.deps.release).toHaveBeenCalled()
    expect(await stored()).toEqual([])
  })

  it('keeps a failed shot until it is exhausted', async () => {
    const h = harness({
      upload: vi.fn(async () => {
        throw new Error('storage 500')
      }),
    })
    const q = queueFor(h)
    q.enqueue('shot-1', file(), NOW)
    await q.drain()

    expect(h.handlers.onDropped).not.toHaveBeenCalled()
    expect(h.handlers.onProgress).toHaveBeenCalledWith('shot-1', 0)
    expect(await stored()).toEqual(['shot-1'])
    expect(armed(h)?.delayMs).toBe(RETRY_MS)
  })

  it('throws away bytes too old to still be a wedding photo', async () => {
    await orphan({ id: 'stale', capturedAt: NOW - MAX_AGE_MS - 1 })
    const h = harness()
    const q = queueFor(h)
    await q.resume()
    await q.drain()

    expect(h.handlers.onRestored).not.toHaveBeenCalled()
    expect(await stored()).toEqual([])
  })

  it('does not let a newer shot overtake a failed older one', async () => {
    let uploads = 0
    const h = harness({
      upload: vi.fn(async () => {
        uploads += 1
        if (uploads === 1) throw new Error('wifi')
      }),
    })
    const q = queueFor(h)
    q.enqueue('older', file(), NOW)
    q.enqueue('newer', file(), NOW + 1)
    await q.drain()

    expect(called(h.deps.reserve)).toBe(1)
    expect(h.handlers.onConfirmed).not.toHaveBeenCalled()

    armed(h)?.run()
    await q.drain()
    expect(h.handlers.onConfirmed).toHaveBeenCalledWith(
      'older',
      expect.any(Number),
    )
    expect(h.handlers.onConfirmed).toHaveBeenCalledWith(
      'newer',
      expect.any(Number),
    )
  })
})

describe('the drain guard', () => {
  /**
   * Reported from a real phone: open the guest page, take a photo, and it lands
   * in IndexedDB and stays there. Reload and it uploads at once.
   *
   * A drain with nothing to do never awaits, so its body ran to completion
   * synchronously and cleared the re-entrancy guard *before* `??=` assigned the
   * promise into it. The guard was then permanently set, every later `drain()`
   * returned that resolved promise without running, and the only thing that
   * ever uploaded was whatever a fresh page's `resume()` had queued before the
   * first drain — which is exactly what a reload does.
   */
  it('survives a drain that had nothing to do', async () => {
    const h = harness()
    const q = queueFor(h)

    // Mounting, with an empty store. This is the drain that used to wedge it.
    await q.resume()
    await q.drain()
    expect(h.deps.reserve).not.toHaveBeenCalled()

    // The guest's first shot.
    q.enqueue('shot-1', file(), NOW)
    await q.drain()

    expect(h.handlers.onConfirmed).toHaveBeenCalledWith(
      'shot-1',
      expect.any(Number),
    )
    expect(await stored()).toEqual([])
  })

  it('keeps draining across any number of idle passes', async () => {
    // Every reactivation calls `resume()`, which drains. On a quiet page those
    // are all idle, and one of them must not be able to retire the uploader.
    const h = harness()
    const q = queueFor(h)
    for (let i = 0; i < 5; i++) await q.resume()

    q.enqueue('shot-1', file(), NOW)
    await q.drain()

    expect(h.handlers.onConfirmed).toHaveBeenCalledOnce()
  })

  it('re-arms rather than swallowing a shot when the loop itself throws', async () => {
    // `notify` already swallows handler errors, so this is about anything that
    // can throw *outside* `runCapture`'s own try — a store that rejects rather
    // than degrading, say. Such a throw used to skip the sweep decision
    // entirely: the shot left memory and nothing was scheduled to fetch it
    // back. The retry then has to get past the rejection it already saw.
    let thrown = false
    const h = harness({
      store: {
        ...uploadStore,
        // The write-ahead attempt bump: the one store call still outside
        // `runCapture`'s own try, and so the one that reaches the loop.
        put: vi.fn(async (shot) => {
          if (!thrown && shot.attempts === 1) {
            thrown = true
            throw new Error('storage went away')
          }
          return uploadStore.put(shot)
        }),
      },
    })
    const q = queueFor(h)
    q.enqueue('shot-1', file(), NOW)
    await q.drain()

    expect(h.handlers.onConfirmed).not.toHaveBeenCalled()
    expect(armed(h)).toBeDefined()

    armed(h)!.run()
    await until(() => called(h.handlers.onConfirmed) === 1)
    expect(h.handlers.onConfirmed).toHaveBeenCalledWith(
      'shot-1',
      expect.any(Number),
    )
  })
})

describe('what the queue reports', () => {
  // Telemetry hooks. None of these changes what happens to a photo; each one
  // is a fact the queue already knew and nobody was told.

  it('reports a prepared capture with its size and timing', async () => {
    const h = harness()
    const q = queueFor(h)
    const input = file()
    q.enqueue('shot-1', input, NOW)
    await q.drain()

    expect(h.handlers.onPrepared).toHaveBeenCalledWith(
      'shot-1',
      input,
      expect.objectContaining({
        ok: true,
        bytes: master.blob.size,
        width: master.width,
        height: master.height,
      }),
    )
  })

  it('reports a failed compression without losing the shot', async () => {
    const h = harness({
      compress: vi.fn(async () => {
        throw new RangeError('out of memory')
      }),
    })
    const q = queueFor(h)
    q.enqueue('shot-1', file(), NOW)
    await q.drain()

    expect(h.handlers.onPrepared).toHaveBeenCalledWith(
      'shot-1',
      expect.anything(),
      expect.objectContaining({ ok: false, error: 'rangeerror' }),
    )
    expect(h.handlers.onConfirmed).toHaveBeenCalledWith(
      'shot-1',
      expect.any(Number),
    )
    expect(h.handlers.onIssue).toHaveBeenCalledWith('shot-1', {
      stage: 'prepare',
      failure: 'rangeerror',
      attempts: 0,
      terminal: false,
    })
  })

  it('names each failure the server answered with', async () => {
    const h = harness({
      upload: vi.fn(async () => {
        throw Object.assign(new Error('HTTP 503'), { status: 503 })
      }),
    })
    const q = queueFor(h)
    q.enqueue('shot-1', file(), NOW)
    await q.drain()

    expect(h.handlers.onIssue).toHaveBeenCalledWith('shot-1', {
      stage: 'upload',
      failure: 'http_503',
      attempts: 1,
      terminal: false,
    })
    expect(h.handlers.onIssue).toHaveBeenCalledOnce()
  })

  it('counts the rows it throws away on resume', async () => {
    await orphan({ id: 'old', capturedAt: NOW - MAX_AGE_MS - 1 })
    await orphan({ id: 'spent', attempts: MAX_ATTEMPTS })
    await orphan({ id: 'fine' })
    const h = harness()
    const q = queueFor(h)
    await q.resume()

    expect(h.handlers.onDiscarded).toHaveBeenCalledWith(
      'old',
      'expired',
      MAX_AGE_MS + 1,
    )
    expect(h.handlers.onDiscarded).toHaveBeenCalledWith(
      'spent',
      'exhausted',
      expect.any(Number),
    )
    expect(h.handlers.onDiscarded).toHaveBeenCalledTimes(2)
    expect(h.handlers.onRestored).toHaveBeenCalledOnce()
  })
})

describe('compressing a capture', () => {
  it('writes the raw file before it decodes anything', async () => {
    // The order this whole feature turns on. A guest who taps the shutter again
    // while the previous shot compresses backgrounds a tab holding a ~50MB
    // bitmap, which is exactly what iOS reclaims. Compressing first and
    // persisting after reopens the window the store exists to close.
    const held = deferred<typeof master>()
    const h = harness({ compress: vi.fn(() => held.promise) })
    const q = queueFor(h)

    q.enqueue('shot-1', file(), NOW)
    await until(async () => (await stored()).length === 1)

    const [row] = await uploadStore.listByEvent(EVENT)
    expect(row.compressed).toBe(false)
    expect(row.name).toBe('IMG_0001.JPG')
    expect(h.deps.reserve).not.toHaveBeenCalled()

    held.resolve(master)
    await q.drain()
  })

  it('replaces the raw bytes with the master, and keeps what the canvas destroys', async () => {
    // `takeAt` and the dimensions are read off the original: the canvas round
    // trip strips EXIF — that is how GPS is removed — so nothing downstream can
    // recover them. `taken_at` is what the host ZIP export sorts the album by.
    const held = deferred<ReturnType<typeof reserved>>()
    const h = harness({ reserve: vi.fn(() => held.promise) })
    const q = queueFor(h)

    q.enqueue('shot-1', file(), NOW)
    await until(async () => {
      const [row] = await uploadStore.listByEvent(EVENT)
      return row?.compressed === true
    })

    const [row] = await uploadStore.listByEvent(EVENT)
    expect(row.blob.size).toBe(master.blob.size)
    expect(row.takenAt).toBe(master.takenAt.toISOString())
    expect(row.width).toBe(4032)
    expect(row.height).toBe(3024)

    held.resolve(reserved('photo-1'))
    await q.drain()
  })

  it('commits the shutter time when the file carries no capture time', async () => {
    // iOS strips EXIF from a live capture before the page ever sees it, so on
    // most guests' phones there is no timestamp in the file. The moment the
    // camera handed the file over is within seconds of the shutter, and it
    // holds however long the upload was delayed. `taken_at` must never be
    // null: it is what the host's ZIP export sorts and stamps the album by.
    const h = harness({
      prepare: vi.fn(async () => ({ ...prepared, takenAt: null })),
    })
    const q = queueFor(h)
    const shutter = NOW - 90_000

    q.enqueue('shot-1', file(), shutter)
    await q.drain()

    expect(h.deps.commit).toHaveBeenCalledWith(
      expect.objectContaining({
        takenAt: new Date(shutter).toISOString(),
      }),
    )
  })

  it('prefers the capture time in the file over the shutter time', async () => {
    // EXIF is more precise and carries the zone it was written in; the
    // shutter press is the fallback, not the answer.
    const h = harness()
    const q = queueFor(h)

    q.enqueue('shot-1', file(), NOW - 90_000)
    await q.drain()

    expect(h.deps.commit).toHaveBeenCalledWith(
      expect.objectContaining({ takenAt: prepared.takenAt!.toISOString() }),
    )
  })

  it('falls back to the shutter time for a restored shot too', async () => {
    // A row replayed after a killed tab has only what was stored: the master,
    // and a `capturedAt` written the instant the shutter fired.
    const shutter = NOW - 60 * 60 * 1000
    const row = await orphan({ takenAt: null, capturedAt: shutter })
    const h = harness({
      prepare: vi.fn(async () => ({ ...prepared, takenAt: null })),
    })
    const q = queueFor(h)

    await q.resume()
    await q.drain()

    expect(h.deps.commit).toHaveBeenCalledWith(
      expect.objectContaining({
        photoId: expect.any(String),
        takenAt: new Date(shutter).toISOString(),
      }),
    )
    expect(await uploadStore.listByEvent(EVENT)).not.toContainEqual(
      expect.objectContaining({ id: row.id }),
    )
  })

  it('compresses once, however many times the shot is retried', async () => {
    // The point of storing the master. Every retry used to decode the original
    // again — a 48MP HEIC through libheif, on a phone, per attempt.
    let uploads = 0
    const h = harness({
      upload: vi.fn(async () => {
        uploads += 1
        if (uploads < 3) throw Object.assign(new Error('500'), { status: 500 })
      }),
    })
    const q = queueFor(h)
    q.enqueue('shot-1', file(), NOW)
    await q.drain()
    for (let i = 0; i < 3 && armed(h); i++) {
      armed(h)!.run()
      await q.drain()
    }

    expect(h.handlers.onConfirmed).toHaveBeenCalled()
    expect(called(h.deps.compress)).toBe(1)
  })

  it('does not compress a shot restored from another tab', async () => {
    await orphan({ id: 'shot-1', compressed: true })
    const h = harness()
    const q = queueFor(h)
    await q.resume()
    await q.drain()

    expect(called(h.deps.compress)).toBe(0)
    expect(h.handlers.onConfirmed).toHaveBeenCalledWith(
      'shot-1',
      expect.any(Number),
    )
  })

  it('still uploads when compression itself fails', async () => {
    // The raw row stays exactly as it is, and `prepare` runs the original
    // pipeline over it. A failed compression costs a decode per attempt, not
    // the photo.
    const h = harness({
      compress: vi.fn(async () => {
        throw new Error('out of memory')
      }),
    })
    const q = queueFor(h)
    q.enqueue('shot-1', file(), NOW)
    await q.drain()

    expect(h.handlers.onConfirmed).toHaveBeenCalledWith(
      'shot-1',
      expect.any(Number),
    )
    expect(h.deps.prepare).toHaveBeenCalledWith(
      expect.objectContaining({ compressed: false }),
    )
  })
})

describe('a frame the server has granted', () => {
  it('is reported, so a cell can match the photo rather than a count', async () => {
    // Positional matching hid the cell still uploading and drew the landed one
    // twice, whenever a deferred shot let a later one overtake it.
    const h = harness({
      reserve: vi.fn(async (key: string) => reserved(`photo-for-${key}`)),
    })
    const q = queueFor(h)
    q.enqueue('shot-1', file(), NOW)
    await q.drain()

    expect(h.handlers.onReserved).toHaveBeenCalledWith(
      'shot-1',
      'photo-for-shot-1',
    )
  })

  it('reports it before the upload, not after the commit', async () => {
    // The cell has to carry an identity for the whole time it is on screen. A
    // photo id that only arrived with the commit would leave the entire upload
    // unmatched, which is exactly the window that goes wrong.
    const order: string[] = []
    const h = harness({
      reserve: vi.fn(async (key: string) => reserved(`photo-${key}`)),
      upload: vi.fn(async () => {
        order.push('upload')
      }),
    })
    h.handlers.onReserved = vi.fn(() => order.push('reserved'))
    const q = queueFor(h)
    q.enqueue('shot-1', file(), NOW)
    await q.drain()

    expect(order).toEqual(['reserved', 'upload'])
  })
})

describe('an attempt the server never saw', () => {
  /**
   * The failure this whole section exists for. `MAX_ATTEMPTS` at `RETRY_MS` is
   * forty seconds, which is a marquee, a lift, or a walk to the car park — and
   * spending the budget on requests that never left the phone turned that into
   * a deleted photo. There is no retake in this product.
   */
  const offline = () => new TypeError('Failed to fetch')

  /** How supabase hands back a PUT that died with the connection. */
  const wrappedOffline = () => ({
    name: 'StorageUnknownError',
    message: 'Failed to fetch',
    originalError: new TypeError('Load failed'),
  })

  it('survives an outage longer than the whole budget', async () => {
    const h = harness({
      reserve: vi.fn(async () => {
        throw offline()
      }),
    })
    const q = queueFor(h)
    q.enqueue('shot-1', file(), NOW)
    await q.drain()

    for (let i = 0; i < MAX_ATTEMPTS + 2 && armed(h); i++) {
      armed(h)!.run()
      await q.drain()
    }

    expect(h.handlers.onDropped).not.toHaveBeenCalled()
    expect(await stored()).toEqual(['shot-1'])
    const [row] = await uploadStore.listByEvent(EVENT)
    expect(row.attempts).toBe(0)
  })

  it('reads the failure supabase actually hands back, not the one it looks like', async () => {
    // `uploadToSignedUrl` returns a `StorageUnknownError`; the real `TypeError`
    // is one level down in `originalError`. Checking the outer name finds
    // nothing, throws nothing, logs nothing — and deletes the photo.
    const h = harness({
      upload: vi.fn(async () => {
        throw wrappedOffline()
      }),
    })
    const q = queueFor(h)
    q.enqueue('shot-1', file(), NOW)
    await q.drain()

    const [row] = await uploadStore.listByEvent(EVENT)
    expect(row.attempts).toBe(0)
    expect(h.handlers.onIssue).toHaveBeenCalledWith('shot-1', {
      stage: 'upload',
      failure: 'connection',
      attempts: 0,
      terminal: false,
    })
  })

  it('still retires a photo the server keeps refusing', async () => {
    // The other half. A budget that is never spent is a photo that retries for
    // a day, so an answer from the server has to count.
    const h = harness({
      upload: vi.fn(async () => {
        throw Object.assign(new Error('HTTP 500'), { status: 500 })
      }),
    })
    const q = queueFor(h)
    q.enqueue('shot-1', file(), NOW)
    await q.drain()
    for (let i = 0; i < MAX_ATTEMPTS + 2 && armed(h); i++) {
      armed(h)!.run()
      await q.drain()
    }

    expect(h.handlers.onDropped).toHaveBeenCalledWith('shot-1', 'exhausted')
    expect(await stored()).toEqual([])
  })

  it('does not charge a guest for leaving the page', async () => {
    // `stop()` runs on unmount, and aborts the transfer in flight. Four visits
    // that each abort an upload used to retire the photo without a single
    // failed request. The fake rejects on the signal the way the real
    // `uploadShotRenders` does — hanging regardless of it would leave
    // `runCapture` suspended and prove nothing.
    const abortable = () =>
      vi.fn(
        ({ signal }: { signal?: AbortSignal }) =>
          new Promise<void>((_resolve, reject) => {
            signal?.addEventListener('abort', () =>
              reject(signal.reason ?? new DOMException('x', 'AbortError')),
            )
          }),
      )

    for (let visit = 0; visit < MAX_ATTEMPTS + 1; visit++) {
      const h = harness({ upload: abortable() })
      const q = queueFor(h)
      if (visit === 0) q.enqueue('shot-1', file(), NOW)
      else await q.resume()
      await until(async () => called(h.deps.upload) === 1)
      q.stop()
      // The attempt goes back on the record, not just in the dead queue's head.
      await until(async () => {
        const [row] = await uploadStore.listByEvent(EVENT)
        return row?.attempts === 0
      })
    }

    const h = harness()
    const q = queueFor(h)
    await q.resume()
    await q.drain()
    expect(h.handlers.onRestored).toHaveBeenCalled()
    expect(h.handlers.onConfirmed).toHaveBeenCalledWith(
      'shot-1',
      expect.any(Number),
    )
  })

  it('waits out an ops kill switch, and is still there after a reload', async () => {
    // `uploads_disabled` is an answer about the server, not about this photo.
    // Spending the budget on it retired good shots for the length of the
    // outage — and poisoned the stored row, so the next load discarded them.
    const h = harness({
      reserve: vi.fn(async () => ({
        ok: false as const,
        refusal: 'uploads_disabled' as const,
      })),
    })
    const q = queueFor(h)
    q.enqueue('shot-1', file(), NOW)
    await q.drain()
    for (let i = 0; i < MAX_ATTEMPTS + 2 && armed(h); i++) {
      armed(h)!.run()
      await q.drain()
    }
    expect(await stored()).toEqual(['shot-1'])
    expect(h.handlers.onIssue).toHaveBeenCalledWith('shot-1', {
      stage: 'reserve',
      failure: 'refusal_uploads_disabled',
      attempts: 0,
      terminal: false,
    })
    expect(h.handlers.onIssue).not.toHaveBeenCalledWith(
      'shot-1',
      expect.objectContaining({ failure: 'connection' }),
    )

    // The kill switch comes off and the guest reopens the page.
    const back = harness()
    const fresh = queueFor(back)
    await fresh.resume()
    await fresh.drain()

    expect(back.handlers.onRestored).toHaveBeenCalled()
    expect(back.handlers.onConfirmed).toHaveBeenCalledWith(
      'shot-1',
      expect.any(Number),
    )
    expect(await stored()).toEqual([])
  })
})

describe('a request that never answers', () => {
  it('gives up on a hung request instead of waiting for ever', async () => {
    const h = harness({
      reserve: vi.fn(() => hang<ReturnType<typeof reserved>>()),
      timeouts: { reserve: 5, upload: 5, commit: 5 },
    })
    const q = queueFor(h)
    q.enqueue('shot-1', file(), NOW)
    await q.drain()

    expect(h.handlers.onDropped).not.toHaveBeenCalled()
    expect(armed(h)?.delayMs).toBe(RETRY_MS)
  })

  it('still uploads the next photo after a timeout', async () => {
    let reserves = 0
    const h = harness({
      reserve: vi.fn(async () => {
        reserves += 1
        if (reserves === 1) return hang<ReturnType<typeof reserved>>()
        return reserved(crypto.randomUUID())
      }),
      timeouts: { reserve: 5, upload: 5, commit: 5 },
    })
    const q = queueFor(h)
    q.enqueue('older', file(), NOW)
    q.enqueue('newer', file(), NOW + 1)
    await q.drain()
    armed(h)?.run()
    await q.drain()

    expect(h.handlers.onConfirmed).toHaveBeenCalledTimes(2)
  })

  it('aborts on teardown without deleting the stored photo', async () => {
    const h = harness({
      reserve: vi.fn(() => hang<ReturnType<typeof reserved>>()),
      timeouts: { reserve: 60_000, upload: 60_000, commit: 60_000 },
    })
    const q = queueFor(h)
    q.enqueue('shot-1', file(), NOW)
    await until(() => called(h.deps.reserve) === 1)
    q.stop()
    await q.drain()

    expect(await stored()).toEqual(['shot-1'])
    expect(h.handlers.onDropped).not.toHaveBeenCalled()
  })
})

describe('the shipped timeouts', () => {
  it('are finite, and generous enough for a real upload', () => {
    expect(REQUEST_TIMEOUTS_MS.reserve).toBeGreaterThan(0)
    expect(REQUEST_TIMEOUTS_MS.upload).toBeGreaterThan(
      REQUEST_TIMEOUTS_MS.reserve,
    )
    expect(REQUEST_TIMEOUTS_MS.commit).toBeGreaterThan(0)
  })
})
