/**
 *     pnpm test
 *
 * Two properties worth pinning:
 * a structured clone does not give a `File` back (so `name` is stored beside
 * the bytes), and nothing here may ever throw.
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
    compressed: true,
    takenAt: null,
    width: 4032,
    height: 3024,
    ...overrides,
  }
}

beforeEach(async () => {
  await __resetForTests()
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
    expect(read.name).toBe('IMG_0001.JPG')
  })

  it('rebuilds a File that still knows it is a HEIC', async () => {
    // Only reachable while a row is still raw — the seconds between the shutter
    // and compression landing, or a compression that failed. In that window an
    // Android picker's HEIC arrives with an empty MIME type, so the extension
    // is the only thing that routes it to the converter on the way back out.
    await uploadStore.put(
      shot({
        compressed: false,
        name: 'IMG_0002.HEIC',
        type: '',
        blob: new Blob([new Uint8Array([1, 2])]),
      }),
    )

    const file = storedFile((await uploadStore.listByEvent(EVENT))[0])
    expect(file).toBeInstanceOf(File)
    expect(file.name).toBe('IMG_0002.HEIC')
  })

  it('keeps one event’s roll out of another’s', async () => {
    await uploadStore.put(shot())
    await uploadStore.put(shot({ eventId: OTHER }))

    expect(await uploadStore.listByEvent(EVENT)).toHaveLength(1)
    expect(await uploadStore.listByEvent(OTHER)).toHaveLength(1)
  })

  it('returns a roll oldest first', async () => {
    await uploadStore.put(shot({ id: 'c', capturedAt: 300 }))
    await uploadStore.put(shot({ id: 'a', capturedAt: 100 }))
    await uploadStore.put(shot({ id: 'b', capturedAt: 200 }))

    expect((await uploadStore.listByEvent(EVENT)).map((row) => row.id)).toEqual(
      ['a', 'b', 'c'],
    )
  })
})

describe('what the canvas destroyed', () => {
  it('is carried as scalars, so a resumed shot keeps its place in the album', async () => {
    // `takenAt` cannot be re-read once `blob` is the master: the round trip
    // that strips GPS strips every other tag with it. The host's ZIP export
    // sorts the album by `taken_at`, so a resumed shot without it would land at
    // the bottom of the wedding.
    await uploadStore.put(
      shot({
        compressed: true,
        takenAt: '2026-08-15T14:32:10.000Z',
        width: 4032,
        height: 3024,
      }),
    )

    const [read] = await uploadStore.listByEvent(EVENT)
    expect(read.compressed).toBe(true)
    expect(read.takenAt).toBe('2026-08-15T14:32:10.000Z')
    expect(read.width).toBe(4032)
    expect(read.height).toBe(3024)
  })
})

describe('finishing with a shot', () => {
  it('forgets it once removed', async () => {
    const only = shot()
    await uploadStore.put(only)
    await expect(uploadStore.remove(only.id)).resolves.toBe(true)
    expect(await uploadStore.listByEvent(EVENT)).toEqual([])
  })

  it('carries the attempt count across a reload', async () => {
    const only = shot()
    await uploadStore.put(only)
    await uploadStore.put({ ...only, attempts: 3 })
    expect((await uploadStore.listByEvent(EVENT))[0].attempts).toBe(3)
  })
})

describe('when the browser will not store anything', () => {
  it('degrades to doing nothing at all, and never throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await __resetForTests()
    vi.stubGlobal('indexedDB', undefined)

    await expect(uploadStore.put(shot())).resolves.toBeUndefined()
    await expect(uploadStore.listByEvent(EVENT)).resolves.toEqual([])
    await expect(uploadStore.remove('anything')).resolves.toBe(false)
  })
})
