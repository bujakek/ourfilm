import 'client-only'

import { openDB, type IDBPDatabase } from 'idb'

import { track } from '@/lib/telemetry'
import { failureClass } from '@/lib/upload-failure'

/**
 * Camera files this device still owes the server.
 *
 * Written when the shutter fires, deleted when `commit_shot` confirms.
 * Presence is the status. Every call swallows: private mode just does not
 * survive a reload.
 */

const DB_NAME = 'ourfilm-uploads'
const DB_VERSION = 1
const STORE = 'shots'
const BY_EVENT = 'by-event'
const OPEN_TIMEOUT_MS = 2000

export type StoredShot = {
  /** The capture id. Also the shot's idempotency key and this store's key. */
  id: string
  eventId: string
  /**
   * The bytes to upload from: the raw camera file at first, replaced by the
   * 3200px master as soon as compression lands. `compressed` says which.
   *
   * The raw write happens before any decode, because that is the window the
   * store exists for — a guest who taps the shutter again while the previous
   * shot is still compressing backgrounds the tab, and a ~50MB bitmap is
   * exactly what makes iOS reclaim it. It is superseded seconds later, so a
   * ~8MB HEIC sits on disk only for those seconds; the steady state is the
   * ~2.2MB master, and a resumed shot never decodes a HEIC again.
   */
  blob: Blob
  /** Whether `blob` is the master. False means the raw camera file. */
  compressed: boolean
  /**
   * Read off the original **before** the canvas strips it — that round trip is
   * how GPS is removed, and it takes every other tag with it.
   *
   * A scalar rather than something to re-read later: once `blob` is the master
   * there is no EXIF left, and `taken_at` is what the host's ZIP export sorts
   * the whole album by. A resumed shot without it falls to the bottom.
   */
  takenAt: string | null
  /** Dimensions of the master, so a resumed shot needs no decode to measure. */
  width: number | null
  height: number | null
  /**
   * File identity, and only meaningful while `compressed` is false.
   *
   * A structured clone is not guaranteed to hand a `File` back — node's returns
   * a bare `Blob` with `name` undefined — and `isHeic()` in `lib/image.ts`
   * falls back to the *filename extension* when the MIME type is empty, which
   * is exactly what Android pickers and iOS share sheets produce. A restored
   * HEIC that had lost its name would take the `createImageBitmap` path and
   * throw on every browser except Safari. Once the bytes are the master this
   * stops being load-bearing: a master is always a JPEG.
   */
  name: string
  type: string
  lastModified: number
  /** When the shutter was pressed. The ordering key, and the age policy's. */
  capturedAt: number
  /**
   * Drains started on this entry, written **before** the attempt runs.
   *
   * Counting afterwards would never count the failure that matters: a decode
   * that runs the tab out of memory takes the whole page with it, so the
   * increment never happens, and the entry retries forever — crashing the tab
   * on every load. Write-ahead is what lets a poison-pill photo evict itself.
   *
   * The queue holds the live count on its own item and re-`put`s the whole row
   * whenever it changes. There is no increment operation here on purpose: two
   * places counting the same thing is two places that can disagree.
   */
  attempts: number
}

export type UploadStore = {
  put(shot: StoredShot): Promise<void>
  listByEvent(eventId: string): Promise<StoredShot[]>
  remove(id: string): Promise<boolean>
}

let handle: Promise<IDBPDatabase | null> | null = null
let warned = false
const captureEvents = new Map<string, string>()

/**
 * Where the store gave up. Reported once per page: the first failure is the
 * one that decided whether this device's photos survive a reload, and the
 * rest follow from it. `missing` is a browser with no IndexedDB at all,
 * `open_timeout` one that never answered, `blocked` an older tab holding a
 * different schema.
 */
type StoreStage =
  'missing' | 'open' | 'open_timeout' | 'blocked' | 'put' | 'list' | 'remove'

function warnOnce(stage: StoreStage, error: unknown, eventId?: string) {
  if (warned) return
  warned = true
  console.warn(
    'Upload store unavailable; uploads will not survive a reload',
    error,
  )
  track(
    'upload_store_unavailable',
    {
      event_id: eventId ?? null,
      stage,
      error: failureClass(error),
    },
    { urgent: true },
  )
}

function database(eventId?: string): Promise<IDBPDatabase | null> {
  if (handle) return handle

  handle = (async () => {
    if (typeof indexedDB === 'undefined') {
      warnOnce('missing', new Error('IndexedDB unavailable'), eventId)
      return null
    }

    try {
      let timer: ReturnType<typeof setTimeout> | undefined
      const opening = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' })
          store.createIndex(BY_EVENT, 'eventId')
        },
        blocked: () =>
          warnOnce(
            'blocked',
            new Error('IndexedDB open blocked by another tab'),
            eventId,
          ),
      })
      const timeout = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), OPEN_TIMEOUT_MS)
      })
      const db = await Promise.race([opening, timeout])
      clearTimeout(timer)
      void opening.catch(() => undefined)
      // A silent null here used to be exactly that — silent. It is the case
      // where every photo on this device is one tab-kill from being lost.
      if (!db)
        warnOnce('open_timeout', new Error('IndexedDB open timed out'), eventId)
      return db ?? null
    } catch (error) {
      warnOnce('open', error, eventId)
      return null
    }
  })()

  return handle
}

export const uploadStore: UploadStore = {
  async put(shot) {
    captureEvents.set(shot.id, shot.eventId)
    const db = await database(shot.eventId)
    if (!db) return
    try {
      await db.put(STORE, shot)
    } catch (error) {
      warnOnce('put', error, shot.eventId)
    }
  },

  async listByEvent(eventId) {
    const db = await database(eventId)
    if (!db) return []
    try {
      const rows = (await db.getAllFromIndex(
        STORE,
        BY_EVENT,
        eventId,
      )) as StoredShot[]
      rows.forEach((shot) => captureEvents.set(shot.id, shot.eventId))
      return rows.sort((a, b) => a.capturedAt - b.capturedAt)
    } catch (error) {
      warnOnce('list', error, eventId)
      return []
    }
  },

  async remove(id) {
    const eventId = captureEvents.get(id)
    const db = await database(eventId)
    if (!db) return false
    try {
      await db.delete(STORE, id)
      captureEvents.delete(id)
      return true
    } catch (error) {
      warnOnce('remove', error, eventId)
      return false
    }
  },
}

/**
 * Rebuild the `File` the camera handed over. See `StoredShot.name`.
 *
 * Only meaningful for a row that is still raw — a compressed row's `blob` is a
 * plain JPEG master and goes to Storage as it stands.
 */
export function storedFile(shot: StoredShot): File {
  return new File([shot.blob], shot.name, {
    type: shot.type,
    lastModified: shot.lastModified,
  })
}

export async function __resetForTests(): Promise<void> {
  const open = handle
  handle = null
  warned = false
  captureEvents.clear()
  try {
    ;(await open)?.close()
  } catch {
    // Already closed.
  }
}
