/**
 * The uploader's rules, which is where this feature actually lives.
 *
 *     pnpm test
 *
 * The queue is a plain factory with every piece of I/O injected, so this file
 * can drive a whole capture — reserve, prepare, upload, commit — without a
 * network, a supabase client or a browser. The store underneath is the **real**
 * `lib/upload-store.ts` over `fake-indexeddb`; a hand-written fake would be a
 * second implementation to keep in step with the first.
 *
 * What is being pinned down is the behaviour a guest can never see going wrong:
 * that a photo is durable before anything can fail, that it is forgotten only
 * once the server has said so, that a refused shot does not come back from the
 * dead on every visibility change, and that a roll goes back up in the order it
 * was shot.
 *
 * No fake timers, deliberately. Every wait lives in `lib/upload-retry.ts`,
 * which this file does not exercise — transport here is a `vi.fn()` — so the
 * suite stays fast and has nothing to flake on.
 */
import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PreparedPhoto } from '@/lib/image'
import {
  createUploadQueue,
  MAX_AGE_MS,
  MAX_ATTEMPTS,
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

/** A promise a test can settle by hand, to hold the queue mid-flight. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

type Harness = {
  deps: UploadQueueDeps
  handlers: UploadQueueHandlers
  now: { value: number }
}

function harness(overrides: Partial<UploadQueueDeps> = {}): Harness {
  const now = { value: NOW }
  const deps: UploadQueueDeps = {
    reserve: vi.fn(async () => reserved(crypto.randomUUID())),
    prepare: vi.fn(async () => prepared),
    upload: vi.fn(async () => undefined),
    commit: vi.fn(async () => ({ committed: true, shotsRemaining: 23 })),
    release: vi.fn(async () => undefined),
    store: uploadStore,
    now: () => now.value,
    ...overrides,
  }
  const handlers: UploadQueueHandlers = {
    onProgress: vi.fn(),
    onConfirmed: vi.fn(),
    onDropped: vi.fn(),
    onRefusal: vi.fn(),
    onAbandoned: vi.fn(),
    onRestored: vi.fn(),
  }
  return { deps, handlers, now }
}

function queueFor(h: Harness) {
  return createUploadQueue({
    eventId: EVENT,
    deps: h.deps,
    handlers: h.handlers,
  })
}

/** Seed the store the way a tab that died mid-upload would have left it. */
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
    lastAttemptAt: null,
    ...overrides,
  }
  await uploadStore.put(row)
  return row
}

/**
 * Wait for something to become true.
 *
 * Used only where a dependency is deliberately held open, so `drain()` cannot
 * be awaited to completion and the test still needs to observe the queue
 * mid-flight. Polling a condition rather than counting turns: a capture awaits
 * a handful of IndexedDB round trips, and how many event-loop turns those take
 * depends on what else the machine is doing. A fixed count passes alone and
 * fails inside `pnpm verify`, which is the worst kind of test.
 */
async function until(condition: () => boolean | Promise<boolean>) {
  for (let i = 0; i < 500; i++) {
    if (await condition()) return
    await new Promise((resolve) => setTimeout(resolve, 1))
  }
  throw new Error('Timed out waiting for the queue to reach the expected state')
}

/** How many times an injected dependency has been called. */
function called(fn: unknown) {
  return (fn as ReturnType<typeof vi.fn>).mock.calls.length
}

/** How many rows the store still holds for the event under test. */
async function stored() {
  return (await uploadStore.listByEvent(EVENT)).map((row) => row.id)
}

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
    // The requirement in one test. The old queue was a ref, so a tab reclaimed
    // during the reserve round trip took the photo with it.
    const held = deferred<ReturnType<typeof reserved>>()
    const h = harness({ reserve: vi.fn(() => held.promise) })
    const queue = queueFor(h)

    queue.enqueue('shot-1', file(), NOW)
    await until(async () => (await stored()).length === 1)

    const rows = await uploadStore.listByEvent(EVENT)
    expect(rows.map((row) => row.id)).toEqual(['shot-1'])
    expect(h.deps.commit).not.toHaveBeenCalled()

    held.resolve(reserved('photo-1'))
    await queue.drain()
  })

  it('is forgotten only once the server has confirmed it', async () => {
    const held = deferred<{ committed: boolean; shotsRemaining: number }>()
    const h = harness({ commit: vi.fn(() => held.promise) })
    const queue = queueFor(h)

    queue.enqueue('shot-1', file(), NOW)
    await until(() => called(h.deps.commit) === 1)

    // Bytes are up, but nothing is committed. The row has to still be there.
    expect(await uploadStore.listByEvent(EVENT)).toHaveLength(1)

    held.resolve({ committed: true, shotsRemaining: 22 })
    await queue.drain()

    expect(await uploadStore.listByEvent(EVENT)).toEqual([])
    expect(h.handlers.onConfirmed).toHaveBeenCalledWith('shot-1', 22)
  })

  it('keeps the row when the commit refuses', async () => {
    const h = harness({
      commit: vi.fn(async () => ({ committed: false, shotsRemaining: 0 })),
    })
    const queue = queueFor(h)

    queue.enqueue('shot-1', file(), NOW)
    await queue.drain()

    expect(await uploadStore.listByEvent(EVENT)).toHaveLength(1)
    expect(h.deps.release).toHaveBeenCalledOnce()
  })

  it('uploads one at a time, in the order shot', async () => {
    // Not tidiness. Two 2MB PUTs racing on venue wifi finish later than the
    // same two in a row, and fail more often.
    const held = deferred<{ committed: boolean; shotsRemaining: number }>()
    const order: string[] = []
    const h = harness({
      reserve: vi.fn(async (key) => {
        order.push(key)
        return reserved(`photo-${key}`)
      }),
      commit: vi.fn(() => held.promise),
    })
    const queue = queueFor(h)

    queue.enqueue('shot-1', file(), NOW)
    queue.enqueue('shot-2', file(), NOW + 1)
    queue.enqueue('shot-3', file(), NOW + 2)
    await until(() => order.length === 1)

    expect(order).toEqual(['shot-1'])

    held.resolve({ committed: true, shotsRemaining: 22 })
    await queue.drain()

    expect(order).toEqual(['shot-1', 'shot-2', 'shot-3'])
  })
})

describe('a refusal', () => {
  it('is never retried, and never resurrects the rest of the roll', async () => {
    // `no_shots` is about the guest, not the file, so everything behind it
    // would hit the same wall. Leaving those rows in the store would mean the
    // next visibility change restores all of them, refuses all of them, and
    // burns a reserve round trip per shot — a safety net turned battery drain.
    const h = harness({
      reserve: vi.fn(async () => ({
        ok: false as const,
        refusal: 'no_shots' as const,
      })),
    })
    const queue = queueFor(h)

    queue.enqueue('shot-1', file(), NOW)
    queue.enqueue('shot-2', file(), NOW + 1)
    queue.enqueue('shot-3', file(), NOW + 2)
    await queue.drain()

    expect(h.deps.prepare).not.toHaveBeenCalled()
    expect(h.deps.upload).not.toHaveBeenCalled()
    // One sentence for the whole queue, not one per photo.
    expect(h.handlers.onRefusal).toHaveBeenCalledOnce()
    expect(h.handlers.onRefusal).toHaveBeenCalledWith('no_shots', {
      restored: false,
    })
    expect(await uploadStore.listByEvent(EVENT)).toEqual([])

    // And it stays gone across a reactivation.
    await queue.resume()
    await queue.drain()
    expect(h.handlers.onRestored).not.toHaveBeenCalled()
  })

  it('tells a restored shot apart from one the guest just took', async () => {
    // "Shooting has ended." is true and unhelpful when the app is quietly
    // cleaning up yesterday's failed byte. The component reads this flag to
    // decide whether to say anything at all.
    await orphan({ id: 'yesterday' })
    const h = harness({
      reserve: vi.fn(async () => ({
        ok: false as const,
        refusal: 'ended' as const,
      })),
    })
    const queue = queueFor(h)

    await queue.resume()
    await queue.drain()

    expect(h.handlers.onRefusal).toHaveBeenCalledWith('ended', {
      restored: true,
    })
    expect(await uploadStore.listByEvent(EVENT)).toEqual([])
  })
})

describe('a tab that died mid-upload', () => {
  it('picks the roll back up, oldest first, and finishes it', async () => {
    // The requirement this whole feature exists for.
    await orphan({ id: 'second', capturedAt: NOW + 1000 })
    await orphan({ id: 'first', capturedAt: NOW })

    const h = harness()
    const queue = queueFor(h)

    await queue.resume()
    await queue.drain()

    const restored = (h.handlers.onRestored as ReturnType<typeof vi.fn>).mock
      .calls
    expect(restored.map(([entry]) => entry.id)).toEqual(['first', 'second'])
    expect(h.deps.commit).toHaveBeenCalledTimes(2)
    expect(h.handlers.onConfirmed).toHaveBeenCalledTimes(2)
    expect(await uploadStore.listByEvent(EVENT)).toEqual([])
  })

  it('hands a resumed shot back the same frame rather than a second one', async () => {
    // The capture id is the idempotency key, so the replay re-claims the frame
    // `reserve_shot` already granted. Nothing here persists a photo id or a
    // signed URL — those expire, and the key does not.
    await orphan({ id: 'shot-1' })
    const h = harness()
    const queue = queueFor(h)

    await queue.resume()
    await queue.drain()

    expect(h.deps.reserve).toHaveBeenCalledWith('shot-1')
  })

  it('does not restore a shot that is still in flight', async () => {
    const held = deferred<ReturnType<typeof reserved>>()
    const h = harness({ reserve: vi.fn(() => held.promise) })
    const queue = queueFor(h)

    queue.enqueue('shot-1', file(), NOW)
    await until(() => called(h.deps.reserve) === 1)

    await queue.resume()

    expect(h.handlers.onRestored).not.toHaveBeenCalled()
    expect(h.deps.reserve).toHaveBeenCalledOnce()

    held.resolve(reserved('photo-1'))
    await queue.drain()
  })

  it('survives two reactivation events firing at once', async () => {
    // `visibilitychange` and `online` land a millisecond apart when a phone
    // comes back onto wifi, and both would otherwise read the store before
    // either had put anything into the queue.
    await orphan({ id: 'shot-1' })
    const h = harness()
    const queue = queueFor(h)

    await Promise.all([queue.resume(), queue.resume()])
    await queue.drain()

    expect(h.handlers.onRestored).toHaveBeenCalledOnce()
    expect(h.deps.reserve).toHaveBeenCalledOnce()
  })
})

describe('giving up', () => {
  it('stops retrying a shot that has had its attempts', async () => {
    // The requirement: retries end, and the guest is told once.
    await orphan({ id: 'doomed', attempts: MAX_ATTEMPTS - 1 })
    const h = harness({
      upload: vi.fn(async () => {
        throw new Error('network is gone')
      }),
    })
    const queue = queueFor(h)

    await queue.resume()
    await queue.drain()

    expect(h.handlers.onDropped).toHaveBeenCalledWith(
      'doomed',
      'exhausted',
      true,
    )
    expect(await uploadStore.listByEvent(EVENT)).toEqual([])

    // And it is not picked up again on the next visit — the count from this
    // resume must not grow, or the shot is being retried forever.
    const restoredSoFar = (h.handlers.onRestored as ReturnType<typeof vi.fn>)
      .mock.calls.length
    await queue.resume()
    await queue.drain()
    expect(h.handlers.onRestored).toHaveBeenCalledTimes(restoredSoFar)
  })

  it('keeps a shot that still has attempts left', async () => {
    await orphan({ id: 'unlucky' })
    const h = harness({
      upload: vi.fn(async () => {
        throw new Error('one bad moment')
      }),
    })
    const queue = queueFor(h)

    await queue.resume()
    await queue.drain()

    expect(h.handlers.onDropped).toHaveBeenCalledWith('unlucky', 'failed', true)
    const [row] = await uploadStore.listByEvent(EVENT)
    expect(row.attempts).toBe(1)
  })

  it('speaks when the guest is standing there, and not when they are not', async () => {
    const h = harness({
      upload: vi.fn(async () => {
        throw new Error('network is gone')
      }),
    })
    const queue = queueFor(h)

    queue.enqueue('shot-1', file(), NOW)
    await queue.drain()

    // `silent` false: this failure followed a shutter press the guest made.
    expect(h.handlers.onDropped).toHaveBeenCalledWith('shot-1', 'failed', false)
  })

  it('throws away bytes too old to still be a wedding photo', async () => {
    await orphan({ id: 'ancient', capturedAt: NOW - MAX_AGE_MS - 1 })
    const h = harness()
    const queue = queueFor(h)

    await queue.resume()
    await queue.drain()

    expect(h.handlers.onRestored).not.toHaveBeenCalled()
    expect(h.deps.reserve).not.toHaveBeenCalled()
    expect(await uploadStore.listByEvent(EVENT)).toEqual([])
  })

  it('throws away a row whose bytes did not survive', async () => {
    // The one cheap guard against a browser that kept the record and lost the
    // blob. There is nothing to upload and never will be.
    await orphan({ id: 'empty', blob: new Blob([]) })
    const h = harness()
    const queue = queueFor(h)

    await queue.resume()
    await queue.drain()

    expect(h.handlers.onRestored).not.toHaveBeenCalled()
    expect(await uploadStore.listByEvent(EVENT)).toEqual([])
  })
})
