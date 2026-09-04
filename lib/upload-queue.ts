import type { ReserveState } from '@/app/(product)/e/[slug]/actions'
import type { ShotRefusal } from '@/lib/capture'
import type { PreparedPhoto } from '@/lib/image'
import type { SignedUpload } from '@/lib/upload-shot'
import { isConnectionFailure } from '@/lib/upload-retry'
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

/**
 * How long to wait before sweeping again, after a drain that left work owed.
 *
 * The queue used to have nothing like this, and the gap was real: every trigger
 * was an *edge* — mount, `visibilitychange`, `pageshow`, `online` — so a missed
 * or premature edge put the queue to sleep until the next one. `online` in
 * particular fires when the interface comes up, not when the connection works,
 * so re-joining wifi routinely produced exactly one doomed attempt and then
 * silence until the guest reloaded the page.
 *
 * Backs off rather than polling, and stops entirely the moment a drain owes
 * nothing. The last value repeats for as long as work remains, which `MAX_AGE_MS`
 * ultimately bounds.
 */
export const SWEEP_DELAYS_MS = [5_000, 15_000, 45_000, 120_000]

/**
 * How long any one network step may hang before it is treated as failed.
 *
 * **A dropped connection does not reliably reject a `fetch`.** Turning wifi off
 * mid-request commonly leaves it pending until an OS-level timeout minutes
 * later, or indefinitely. Without a ceiling, one such request wedges the entire
 * uploader: `runCapture` never returns, the drain loop never advances, and
 * because the sweep is armed *after* that loop it can never be armed at all.
 * Worse, every photo taken afterwards — on a perfectly good connection — queues
 * behind the hung one and sits in the store untouched. Only a reload clears it,
 * which is exactly how this was found.
 *
 * The request itself cannot be cancelled from here, so a late reply is simply
 * ignored; the PUTs upsert and `reserve_shot` is idempotent, so nothing a
 * straggler does can be harmful.
 */
export const REQUEST_TIMEOUTS_MS = {
  /** A small JSON round trip. */
  reserve: 20_000,
  /** Three renders, up to a few MB, on the worst network the product sees. */
  upload: 120_000,
  /** A small JSON round trip. */
  commit: 20_000,
}

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
  /**
   * How the queue comes back to itself. A timer is I/O like everything else
   * here, so it is injected rather than reached for — a test drives the clock
   * instead of waiting on one. Returns a cancel.
   */
  schedule?: (run: () => void, delayMs: number) => () => void
  /** Overridable so a test does not have to wait out a real hang. */
  timeouts?: typeof REQUEST_TIMEOUTS_MS
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
  /** Cancel any pending sweep. For tests and teardown; the page itself simply
   *  keeps the queue for as long as it keeps the tab. */
  stop(): void
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
  const limits = deps.timeouts ?? REQUEST_TIMEOUTS_MS
  const schedule =
    deps.schedule ??
    ((run, delayMs) => {
      const timer = setTimeout(run, delayMs)
      return () => clearTimeout(timer)
    })
  const pending: QueueItem[] = []

  // Refs rather than state, and two of them rather than one. `draining` guards
  // the loop; `resuming` guards the scan. They must be separate because
  // `visibilitychange` and `online` can fire a millisecond apart and both would
  // read the store before either had finished putting anything into the queue.
  let draining: Promise<void> | null = null
  let resuming = false
  /** The pending sweep's cancel, or null when none is armed. */
  let sweep: (() => void) | null = null
  let backoff = 0

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
   * Stop waiting on a request that is never going to answer.
   *
   * Rejects with the same `TimeoutError` shape a browser produces, so
   * `isConnectionFailure` already reads it as "nothing left the device" and the
   * attempt is refunded rather than spent.
   */
  function withTimeout<T>(work: Promise<T>, ms: number, what: string) {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new DOMException(`${what} timed out`, 'TimeoutError')),
        ms,
      )
      work.then(
        (value) => {
          clearTimeout(timer)
          resolve(value)
        },
        (error: unknown) => {
          clearTimeout(timer)
          reject(error)
        },
      )
    })
  }

  /** Whether a request stands any chance of leaving the device. */
  function online(): boolean {
    return typeof navigator === 'undefined' || navigator.onLine !== false
  }

  /**
   * Come back and try again later.
   *
   * This is the queue's only self-starting trigger, and the reason it exists is
   * that all the others are edges someone else controls.
   */
  function scheduleSweep(): void {
    if (sweep !== null) return
    const delay = SWEEP_DELAYS_MS[Math.min(backoff, SWEEP_DELAYS_MS.length - 1)]
    backoff += 1
    sweep = schedule(() => {
      sweep = null
      void resume()
    }, delay)
  }

  /** Nothing is owed, so stop asking and forget how long we had been waiting. */
  function cancelSweep(): void {
    sweep?.()
    sweep = null
    backoff = 0
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

      // The bytes are safe and the network is not. Trying now would spend a
      // round trip that cannot leave the device — which is exactly what a
      // premature `online` edge used to do — so re-arm and stay quiet.
      if (rows.length > 0 && !online()) {
        scheduleSweep()
        return
      }

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
      let owed = false
      let ran = 0
      try {
        for (let next = pending.shift(); next; next = pending.shift()) {
          ran += 1
          owed = (await runCapture(next)) || owed
        }
      } finally {
        draining = null
      }
      // The queue asks for itself back rather than waiting to be asked.
      //
      // A drain that ran nothing decides nothing: an empty queue is not
      // evidence that the store is empty too, and treating it as such would
      // let an idle pass disarm the sweep a failed one had just armed.
      if (owed) scheduleSweep()
      else if (ran > 0) cancelSweep()
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

  /** Returns whether this shot is still owed — i.e. worth another sweep. */
  async function runCapture(item: QueueItem): Promise<boolean> {
    let photoId: string | null = null

    // Written before the attempt, not after: a decode that runs the tab out of
    // memory takes the page with it, and a count that only increments on a
    // clean failure would let that photo retry forever.
    await deps.store.bumpAttempt(item.id, clock())

    try {
      const reserved = await withTimeout(
        deps.reserve(item.id),
        limits.reserve,
        'Reserving a frame',
      )

      if (!reserved.ok) {
        const abandoned = await abandonQueue()
        claimed.delete(item.id)
        await deps.store.remove(item.id)
        handlers.onDropped(item.id, 'refused', item.restored)
        if (abandoned.length > 0) handlers.onAbandoned(abandoned)
        handlers.onRefusal(reserved.refusal, { restored: item.restored })
        // A refusal is an answer, not a failure. Nothing is owed and nothing
        // about waiting would change it.
        return false
      }

      photoId = reserved.photoId
      // Not timed out: this is local CPU work, and racing a decode would free
      // no memory while leaving the bitmap alive behind it.
      const prepared = await deps.prepare(item.file)
      await withTimeout(
        deps.upload({
          prepared,
          uploads: reserved.uploads,
          onProgress: (fraction) => handlers.onProgress(item.id, fraction),
        }),
        limits.upload,
        'Uploading a photo',
      )

      const committed = await withTimeout(
        deps.commit({
          photoId,
          width: prepared.width,
          height: prepared.height,
          byteSize: prepared.full.size,
          takenAt: prepared.takenAt?.toISOString() ?? null,
        }),
        limits.commit,
        'Confirming a photo',
      )

      if (!committed.committed) throw new Error('commit refused')

      // First, before the counter and before the refresh. The window between a
      // successful commit and this delete is the only one in which a crash
      // could make a landed photo look unfinished and replay it, so it is kept
      // as close to nothing as it can be.
      await deps.store.remove(item.id)
      claimed.delete(item.id)
      handlers.onConfirmed(item.id, committed.shotsRemaining)
      return false
    } catch (error) {
      console.error('Native camera upload failed', error)
      claimed.delete(item.id)

      // Nothing left the device — no wifi, or it dropped mid-request. Give the
      // attempt back: the budget is there to retire a photo the server keeps
      // rejecting, not to punish a guest for walking out of range. Without
      // this, four bad reconnects would delete a photo that was never sent
      // once.
      const unsent = isConnectionFailure(error) || !online()
      if (unsent) await deps.store.refundAttempt(item.id)

      // Whether this was the last go is decided by what is on the record, not
      // by anything in memory — the reload is the thing being survived.
      const remainingRow = await currentRow(item.id)
      const exhausted =
        !unsent && (!remainingRow || remainingRow.attempts >= MAX_ATTEMPTS)
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

      // Still owed unless we have given up on it for good.
      return !exhausted
    }
  }

  async function currentRow(id: string): Promise<StoredShot | undefined> {
    const rows = await deps.store.listByEvent(eventId)
    return rows.find((row) => row.id === id)
  }

  return { enqueue, resume, drain, stop: cancelSweep }
}
