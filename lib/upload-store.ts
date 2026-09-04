import 'client-only'

import { openDB, type IDBPDatabase } from 'idb'

/**
 * The captured photos this device still owes the server.
 *
 * A guest's queue used to live only in a ref on `guest-event-view.tsx`, and a
 * ref does not survive a reload. On the guest path a reload is routine rather
 * than exceptional: tapping the shutter hands the screen to the OS camera, and
 * iOS reclaims a backgrounded tab whenever it feels like it. Every photo
 * captured but not yet committed was silently gone — and there is no retake in
 * this product, so that is not a lost upload, it is a lost moment.
 *
 * A row here means exactly one thing: **these bytes were captured and have not
 * been committed.** There is deliberately no `status` column. Presence *is* the
 * status, and a second field saying the same thing is a second thing that can
 * be wrong.
 *
 * **Nothing in this module ever throws.** Every export swallows and degrades:
 * `put` does nothing, `list` returns nothing, `remove` does nothing. A guest in
 * Safari private mode, or one whose disk is full, gets exactly the behaviour
 * this product had before the store existed — uploads work, nothing survives a
 * reload. The store is a safety net and a safety net must never be a gate.
 */

const DB_NAME = 'ourfilm-uploads'
const DB_VERSION = 1
const STORE = 'shots'
const BY_EVENT = 'by-event'

/**
 * `indexedDB.open` can hang indefinitely rather than failing: an open holding a
 * `versionchange` in another tab blocks this one, and a guest with the event
 * page open twice is not a hypothetical. Nothing may wait on this store, so a
 * hung open has to resolve as "no store" rather than as a pending promise the
 * capture path might one day await.
 */
const OPEN_TIMEOUT_MS = 2000

export type StoredShot = {
  /** The capture id. Also the shot's idempotency key and this store's key. */
  id: string
  eventId: string
  /** The camera bytes, exactly as the file input handed them over. */
  blob: Blob
  /**
   * File identity, stored beside the bytes rather than trusted to survive
   * inside them.
   *
   * A structured clone is not guaranteed to hand a `File` back — node's returns
   * a bare `Blob` with `name` undefined — and `isHeic()` in `lib/image.ts`
   * falls back to the *filename extension* when the MIME type is empty, which
   * is exactly what Android pickers and iOS share sheets produce. A restored
   * HEIC that had lost its name would take the `createImageBitmap` path and
   * throw on every browser except Safari.
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
   */
  attempts: number
  lastAttemptAt: number | null
}

/** The seam the queue is written against, so tests can hand it a fake. */
export type UploadStore = {
  put(shot: StoredShot): Promise<void>
  listByEvent(eventId: string): Promise<StoredShot[]>
  remove(id: string): Promise<void>
  bumpAttempt(id: string, now: number): Promise<void>
}

let handle: Promise<IDBPDatabase | null> | null = null
let warned = false

/** One line per session, never one per call: a private-mode guest shooting a
 *  36-frame roll must not write 36 identical warnings. */
function warnOnce(error: unknown) {
  if (warned) return
  warned = true
  console.warn(
    'Upload store unavailable; uploads will not survive a reload',
    error,
  )
}

/**
 * Opens the database once and remembers the answer, including "no".
 *
 * A refusal here is permanent for the life of the page — private mode, storage
 * disabled, a `SecurityError` — so retrying it on every shutter press is 36
 * more chances to hang for an answer that will not change.
 */
function database(): Promise<IDBPDatabase | null> {
  if (handle) return handle

  handle = (async () => {
    // Never at module scope: Next evaluates `'use client'` modules on the
    // server for the initial render, where there is no indexedDB at all.
    if (typeof indexedDB === 'undefined') return null

    try {
      let timer: ReturnType<typeof setTimeout> | undefined
      const opening = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' })
          store.createIndex(BY_EVENT, 'eventId')
        },
        // Another tab of the same event holding an older version open. Nothing
        // here can wait for it, so give up on this tab's store instead.
        blocked: () =>
          warnOnce(new Error('IndexedDB open blocked by another tab')),
      })
      const timeout = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), OPEN_TIMEOUT_MS)
      })
      const db = await Promise.race([opening, timeout])
      clearTimeout(timer)
      // A late-resolving open would otherwise reject into nothing.
      void opening.catch(() => undefined)
      return db ?? null
    } catch (error) {
      warnOnce(error)
      return null
    }
  })()

  return handle
}

async function write(shot: StoredShot, db: IDBPDatabase): Promise<void> {
  await db.put(STORE, shot)
}

export const uploadStore: UploadStore = {
  /**
   * Persist one captured shot.
   *
   * Called from the shutter and deliberately never awaited there: the preview,
   * the film-strip cell and the drain all happen first. A guest must not wait
   * on a disk write to see their photo start developing.
   */
  async put(shot) {
    const db = await database()
    if (!db) return

    try {
      await write(shot, db)
    } catch (error) {
      if (!isQuotaError(error)) {
        warnOnce(error)
        return
      }
      // Make room and try once more. Evict entries that have already had a go
      // at uploading, oldest first, and other events before this one — never
      // the shot being written, which is the photo the guest is watching.
      try {
        const all = (await db.getAll(STORE)) as StoredShot[]
        const evictable = all
          .filter((row) => row.id !== shot.id && row.attempts > 0)
          .sort(
            (a, b) =>
              Number(a.eventId === shot.eventId) -
                Number(b.eventId === shot.eventId) ||
              a.capturedAt - b.capturedAt,
          )
        for (const row of evictable) await db.delete(STORE, row.id)
        await write(shot, db)
      } catch (retryError) {
        // A full disk is not a reason to break the camera. This shot simply
        // will not survive a reload, which is where the product was before.
        warnOnce(retryError)
      }
    }
  },

  /** Oldest first: a roll has to go back up in the order it was shot. */
  async listByEvent(eventId) {
    const db = await database()
    if (!db) return []

    try {
      const rows = (await db.getAllFromIndex(
        STORE,
        BY_EVENT,
        eventId,
      )) as StoredShot[]
      return rows.sort((a, b) => a.capturedAt - b.capturedAt)
    } catch (error) {
      warnOnce(error)
      return []
    }
  },

  async remove(id) {
    const db = await database()
    if (!db) return

    try {
      await db.delete(STORE, id)
    } catch (error) {
      warnOnce(error)
    }
  },

  async bumpAttempt(id, now) {
    const db = await database()
    if (!db) return

    try {
      const tx = db.transaction(STORE, 'readwrite')
      const row = (await tx.store.get(id)) as StoredShot | undefined
      // Gone already means committed already. Not an error, and not something
      // to recreate — a re-added row would be uploaded a second time.
      if (row) {
        await tx.store.put({
          ...row,
          attempts: row.attempts + 1,
          lastAttemptAt: now,
        })
      }
      await tx.done
    } catch (error) {
      warnOnce(error)
    }
  },
}

/** Rebuild the `File` the camera handed over. See `StoredShot.name`. */
export function storedFile(shot: StoredShot): File {
  return new File([shot.blob], shot.name, {
    type: shot.type,
    lastModified: shot.lastModified,
  })
}

function isQuotaError(error: unknown): boolean {
  return (
    typeof DOMException !== 'undefined' &&
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' ||
      // Firefox's older spelling, still emitted by some engines.
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}

/**
 * Drops the memoised handle so a test file can start from a clean database.
 *
 * Closes the connection rather than only forgetting it: an open connection
 * blocks `deleteDatabase`, so a reset that merely dropped the reference would
 * hang the next test instead of isolating it.
 */
export async function __resetForTests(): Promise<void> {
  const open = handle
  handle = null
  warned = false
  try {
    ;(await open)?.close()
  } catch {
    // Already closed, or never opened. Either way there is nothing to release.
  }
}
