/**
 * The store that makes a captured photo outlive its tab.
 *
 *     pnpm test
 *
 * Runs against `fake-indexeddb`, which delegates to the platform's own
 * `structuredClone`, so a `Blob` round-trips here the way it does in a browser.
 *
 * Two properties are worth the file on their own:
 *
 * **A structured clone does not give a `File` back.** Node's returns a bare
 * `Blob` with `name` undefined. `isHeic()` in `lib/image.ts` falls back to the
 * *filename extension* when the MIME type is empty — which is exactly what
 * Android pickers and iOS share sheets produce — so a restored HEIC that had
 * lost its name would take the wrong decode path and throw on every browser
 * except Safari. Hence `name`, `type` and `lastModified` are stored as their
 * own fields, and the test below is what stops someone "simplifying" that away.
 *
 * **Nothing here may ever throw.** A guest in private mode must get the
 * behaviour this product had before the store existed — uploads work, nothing
 * survives a reload — and never an error. That is asserted, not commented.
 */
import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  storedFile,
  uploadStore,
  __resetForTests,
  type StoredShot,
} from '@/lib/upload-store'

const EVENT = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'

function shot(overrides: Partial<StoredShot> = {}): StoredShot {
  return {
    id: crypto.randomUUID(),
    eventId: EVENT,
    blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xdb])], {
      type: 'image/jpeg',
    }),
    name: 'IMG_0001.JPG',
    type: 'image/jpeg',
    lastModified: 1_700_000_000_000,
    capturedAt: 1_700_000_000_000,
    attempts: 0,
    lastAttemptAt: null,
    ...overrides,
  }
}

beforeEach(async () => {
  await __resetForTests()
  // A fresh database per test: the store memoises its handle, and one test's
  // rows showing up in the next would make the ordering cases meaningless.
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase('ourfilm-uploads')
    request.onsuccess = request.onerror = request.onblocked = () => resolve()
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('keeping a captured shot', () => {
  it('round-trips the bytes and the file identity', async () => {
    const original = shot()
    await uploadStore.put(original)

    const [read] = await uploadStore.listByEvent(EVENT)
    expect(read.id).toBe(original.id)
    expect(read.blob.size).toBe(4)
    expect(read.blob.type).toBe('image/jpeg')
    expect(read.name).toBe('IMG_0001.JPG')
    expect(read.lastModified).toBe(1_700_000_000_000)
  })

  it('rebuilds a File that still knows it is a HEIC', async () => {
    // The case the separate `name` field exists for: an Android picker hands
    // over a HEIC with an empty MIME type, so the extension is the only thing
    // that will route it to the converter on the way back out.
    await uploadStore.put(
      shot({
        name: 'IMG_0002.HEIC',
        type: '',
        blob: new Blob([new Uint8Array([1, 2])]),
      }),
    )

    const [read] = await uploadStore.listByEvent(EVENT)
    const file = storedFile(read)
    expect(file).toBeInstanceOf(File)
    expect(file.name).toBe('IMG_0002.HEIC')
    expect(file.size).toBe(2)
  })

  it('keeps one event’s roll out of another’s', async () => {
    await uploadStore.put(shot())
    await uploadStore.put(shot({ eventId: OTHER }))

    expect(await uploadStore.listByEvent(EVENT)).toHaveLength(1)
    expect(await uploadStore.listByEvent(OTHER)).toHaveLength(1)
  })

  it('returns a roll oldest first', async () => {
    // Not tidiness: a frame's index is its place on the strip, so a roll has to
    // go back up in the order it was shot.
    await uploadStore.put(shot({ id: 'c', capturedAt: 300 }))
    await uploadStore.put(shot({ id: 'a', capturedAt: 100 }))
    await uploadStore.put(shot({ id: 'b', capturedAt: 200 }))

    const rows = await uploadStore.listByEvent(EVENT)
    expect(rows.map((row) => row.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('finishing with a shot', () => {
  it('forgets it once removed', async () => {
    const only = shot()
    await uploadStore.put(only)
    await uploadStore.remove(only.id)
    expect(await uploadStore.listByEvent(EVENT)).toEqual([])
  })

  it('counts an attempt against the record, not against memory', async () => {
    // The whole point is surviving the reload. A counter in a ref would reset
    // on exactly the event this policy exists to bound.
    const only = shot()
    await uploadStore.put(only)
    await uploadStore.bumpAttempt(only.id, 1_700_000_009_000)

    const [read] = await uploadStore.listByEvent(EVENT)
    expect(read.attempts).toBe(1)
    expect(read.lastAttemptAt).toBe(1_700_000_009_000)
  })

  it('does not resurrect a row that has already been committed away', async () => {
    // A bump racing a commit must not put the shot back, or it would be
    // uploaded a second time on the next reactivation.
    await uploadStore.bumpAttempt('never-existed', 1)
    expect(await uploadStore.listByEvent(EVENT)).toEqual([])
  })
})

describe('when the browser will not store anything', () => {
  it('degrades to doing nothing at all, and never throws', async () => {
    // Safari in private mode, storage disabled, a full disk. The guest gets the
    // behaviour this product had before the store existed: the upload still
    // works, it just does not survive a reload. A safety net is never a gate.
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await __resetForTests()
    vi.stubGlobal('indexedDB', undefined)

    await expect(uploadStore.put(shot())).resolves.toBeUndefined()
    await expect(uploadStore.listByEvent(EVENT)).resolves.toEqual([])
    await expect(uploadStore.remove('anything')).resolves.toBeUndefined()
    await expect(
      uploadStore.bumpAttempt('anything', 1),
    ).resolves.toBeUndefined()
  })
})
