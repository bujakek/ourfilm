import type { ReserveState } from '@/app/(product)/e/[slug]/actions'
import type { ShotRefusal } from '@/lib/capture'
import type { PreparedPhoto } from '@/lib/image'
import type { SignedUpload } from '@/lib/upload-shot'
import {
  storedFile,
  type StoredShot,
  type UploadStore,
} from '@/lib/upload-store'

/**
 * The guest's uploader: what is owed, in what order, and when to stop asking.
 *
 * This used to live inside `guest-event-view.tsx` as two refs and two
 * callbacks. It is out here because almost none of it is React — draining one
 * at a time, refusing to resurrect a refused shot, giving up on a photo that
 * will never land, replaying an orphan after a reload — and all of it is the
 * code that breaks in a field where nobody is watching. The vitest suite is
 * node-only and reaches `lib/` but never a `.tsx`, so orchestration left in the
 * component is orchestration that ships untested.
 *
 * Every piece of I/O is injected. Nothing here imports a server action, a
 * supabase client or the image pipeline — the type-only imports above are
 * erased, so none of `client-only`, `server-only` or `next/cache` enters the
 * graph, and a test hands over `vi.fn()`s instead.
 *
 * ## Why resume replays rather than resumes
 *
 * A stored shot keeps its bytes and its capture id and **nothing else** — no
 * photo id, no signed upload URLs. Resuming means calling `reserve` again with
 * the same id, because that id is the shot's idempotency key: `reserve_shot`
 * looks it up and hands back the frame it already granted rather than spending
 * a second one. Persisting the signed URLs instead would have been the obvious
 * shape and is the wrong one — they expire in two hours, the pending
 * reservation behind them expires in ten minutes, and a replay gets fresh ones
 * for free.
 *
 * The whole path is replay-safe, which is what makes this cheap: reserve
 * returns the same row whether it is pending or already committed, the three
 * PUTs upsert over bytes that may already be there, and `commit_shot` re-commits
 * without complaint. The worst case of a redundant replay is one duplicate
 * upload, never a spent frame or a duplicate photo.
 */

/** Drains started on one shot before it is written off. Each one carries its
 *  own transport retries underneath, so this is the outer budget: past four
 *  whole attempts it is not the network. */
export const MAX_ATTEMPTS = 4

/** An event is one evening. Bytes still on the phone a day later will not
 *  become a wedding photo, and they are holding megabytes of someone's disk. */
export const MAX_AGE_MS = 24 * 60 * 60 * 1000

export type UploadQueueDeps = {
  reserve: (idempotencyKey: string) => Promise<ReserveState>
  prepare: (file: File) => Promise<PreparedPhoto>
  upload: (args: {
    prepared: PreparedPhoto
    uploads: { full: SignedUpload; view: SignedUpload; thumb: SignedUpload }
    onProgress?: (fraction: number) => void
  }) => Promise<void>
  commit: (args: {
    photoId: string
    width: number
    height: number
    byteSize: number
    takenAt: string | null
  }) => Promise<{ committed: boolean; shotsRemaining: number }>
  release: (photoId: string) => Promise<void>
  store: UploadStore
  /** Injected so the age policy is testable, like everything in `lib/camera.ts`. */
  now?: () => number
}

export type UploadQueueHandlers = {
  onProgress(id: string, fraction: number): void
  onConfirmed(id: string, shotsRemaining: number): void
  /** `silent` is true when nothing on screen prompted this — a background
   *  resume tidying up after itself has no business raising an error. */
  onDropped(
    id: string,
    reason: 'failed' | 'refused' | 'exhausted',
    silent: boolean,
  ): void
  onRefusal(refusal: ShotRefusal, options: { restored: boolean }): void
  onAbandoned(ids: string[]): void
  onRestored(entry: { id: string; file: File; capturedAt: number }): void
}

/** One shot waiting its turn. `restored` decides whether a refusal speaks. */
type QueueItem = {
  id: string
  file: File
  capturedAt: number
  restored: boolean
}

export type UploadQueue = {
  enqueue(id: string, file: File, capturedAt: number): void
  resume(): Promise<void>
  drain(): Promise<void>
}

export function createUploadQueue({
  eventId,
  deps,
  handlers,
}: {
  eventId: string
  deps: UploadQueueDeps
  handlers: UploadQueueHandlers
}): UploadQueue {
  const clock = deps.now ?? (() => Date.now())
  const pending: QueueItem[] = []

  // Refs rather than state, and two of them rather than one. `draining` guards
  // the loop; `resuming` guards the scan. They must be separate because
  // `visibilitychange` and `online` can fire a millisecond apart and both would
  // read the store before either had finished putting anything into the queue.
  let draining: Promise<void> | null = null
  let resuming = false

  /** Everything the queue is currently responsible for, so a resume cannot
   *  restore a shot that is already in flight or already waiting. */
  const claimed = new Set<string>()

  function enqueue(id: string, file: File, capturedAt: number) {
    if (claimed.has(id)) return
    claimed.add(id)
    pending.push({ id, file, capturedAt, restored: false })

    // Persist before anything else can go wrong, and never await it: the
    // preview, the developing cell and the drain all happen first. A guest does
    // not wait on a disk write to watch their photo start developing, and a
    // store that is unavailable must cost them nothing at all.
    void deps.store.put({
      id,
      eventId,
      blob: file,
      name: file.name,
      type: file.type,
      lastModified: file.lastModified,
      capturedAt,
      attempts: 0,
      lastAttemptAt: null,
    })

    void drain()
  }

  /**
   * Pick up whatever a killed tab left behind.
   *
   * Runs on mount and on every reactivation. Cheap when there is nothing to do,
   * which is the overwhelmingly common case.
   */
  async function resume(): Promise<void> {
    if (resuming) return
    resuming = true

    try {
      const rows = await deps.store.listByEvent(eventId)
      const at = clock()

      for (const row of rows) {
        // Already ours. Covers the shutter-then-backgrounded case, where the
        // shot is mid-flight and its row is still rightly in the store.
        if (claimed.has(row.id)) continue

        if (!survives(row, at)) {
          await deps.store.remove(row.id)
          continue
        }

        claimed.add(row.id)
        const file = storedFile(row)
        // Ordering is the store's — oldest first. A roll goes back up in the
        // order it was shot, because a frame's index is its place on the strip.
        pending.push({
          id: row.id,
          file,
          capturedAt: row.capturedAt,
          restored: true,
        })
        handlers.onRestored({ id: row.id, file, capturedAt: row.capturedAt })
      }
    } finally {
      resuming = false
    }

    void drain()
  }

  /**
   * Whether an entry is still worth trying.
   *
   * A zero-byte blob is the one cheap guard against a browser that stored the
   * reference and lost the bytes; there is nothing to upload and never will be.
   */
  function survives(row: StoredShot, at: number): boolean {
    if (row.blob.size === 0) return false
    if (row.attempts >= MAX_ATTEMPTS) return false
    return at - row.capturedAt <= MAX_AGE_MS
  }

  /**
   * Drains the queue, one shot at a time.
   *
   * **One at a time on purpose.** The database is ready for the other answer —
   * `reserve_shot` takes `for update` on the *participant* row precisely so one
   * guest's concurrent captures serialise — but the network is not. These
   * uploads happen on venue wifi shared by a hundred phones, and two 2MB PUTs
   * racing each other there finish later than the same two in a row and fail
   * more often. Nothing is gained by overlapping them either: the guest is
   * inside the OS camera while the queue drains, not watching it.
   *
   * The re-entrancy guard is a plain variable rather than React state because
   * it must be set before the next line runs, not after the next render.
   */
  function drain(): Promise<void> {
    // Returns the *running* drain rather than a resolved promise, so a caller
    // that wants to know when the queue is empty can await it instead of
    // guessing. The re-entrancy guarantee is unchanged: one loop, ever.
    draining ??= (async () => {
      try {
        for (let next = pending.shift(); next; next = pending.shift()) {
          await runCapture(next)
        }
      } finally {
        draining = null
      }
    })()
    return draining
  }

  /**
   * Everything behind this one is doomed too.
   *
   * A refusal is about this guest or this event, never about this file, so the
   * rest of the queue would hit the same wall — showing the same sentence once
   * per photo. Their stored rows go with them: left behind, the next
   * reactivation would restore all of them, hit the same refusal, and burn a
   * reserve round trip per shot per visibility change. That is the difference
   * between a safety net and a battery drain.
   */
  async function abandonQueue(): Promise<string[]> {
    const doomed = pending.splice(0, pending.length)
    for (const item of doomed) {
      claimed.delete(item.id)
      await deps.store.remove(item.id)
    }
    return doomed.map((item) => item.id)
  }

  async function runCapture(item: QueueItem): Promise<void> {
    let photoId: string | null = null

    // Written before the attempt, not after: a decode that runs the tab out of
    // memory takes the page with it, and a count that only increments on a
    // clean failure would let that photo retry forever.
    await deps.store.bumpAttempt(item.id, clock())

    try {
      const reserved = await deps.reserve(item.id)

      if (!reserved.ok) {
        const abandoned = await abandonQueue()
        claimed.delete(item.id)
        await deps.store.remove(item.id)
        handlers.onDropped(item.id, 'refused', item.restored)
        if (abandoned.length > 0) handlers.onAbandoned(abandoned)
        handlers.onRefusal(reserved.refusal, { restored: item.restored })
        return
      }

      photoId = reserved.photoId
      const prepared = await deps.prepare(item.file)
      await deps.upload({
        prepared,
        uploads: reserved.uploads,
        onProgress: (fraction) => handlers.onProgress(item.id, fraction),
      })

      const committed = await deps.commit({
        photoId,
        width: prepared.width,
        height: prepared.height,
        byteSize: prepared.full.size,
        takenAt: prepared.takenAt?.toISOString() ?? null,
      })

      if (!committed.committed) throw new Error('commit refused')

      // First, before the counter and before the refresh. The window between a
      // successful commit and this delete is the only one in which a crash
      // could make a landed photo look unfinished and replay it, so it is kept
      // as close to nothing as it can be.
      await deps.store.remove(item.id)
      claimed.delete(item.id)
      handlers.onConfirmed(item.id, committed.shotsRemaining)
    } catch (error) {
      console.error('Native camera upload failed', error)
      claimed.delete(item.id)

      // Whether this was the last go is decided by what is on the record, not
      // by anything in memory — the reload is the thing being survived.
      const remainingRow = await currentRow(item.id)
      const exhausted = !remainingRow || remainingRow.attempts >= MAX_ATTEMPTS
      if (exhausted) await deps.store.remove(item.id)

      handlers.onDropped(
        item.id,
        exhausted ? 'exhausted' : 'failed',
        // A background resume that quietly gives up says nothing. A guest
        // standing there having just pressed the shutter is told.
        item.restored,
      )

      // Best effort and deliberately not awaited: the reservation expires on
      // its own after ten minutes, and the next shot should not wait on the
      // cleanup of the last one.
      if (photoId) void deps.release(photoId)
    }
  }

  async function currentRow(id: string): Promise<StoredShot | undefined> {
    const rows = await deps.store.listByEvent(eventId)
    return rows.find((row) => row.id === id)
  }

  return { enqueue, resume, drain }
}
