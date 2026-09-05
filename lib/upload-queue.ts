import type { ReserveState } from '@/app/(product)/e/[slug]/actions'
import type { ShotRefusal } from '@/lib/capture'
import type { CompressedCapture, PreparedPhoto } from '@/lib/image'
import type { SignedUpload } from '@/lib/upload-shot'
import { failureClass, isConnectionFailure } from '@/lib/upload-failure'
import type { StoredShot, UploadStore } from '@/lib/upload-store'

/**
 * Persist the camera file, upload one at a time, replay after a killed tab.
 *
 * iOS reclaims a tab handed to the OS camera. Without a store that is a lost
 * photo, and this product has no retake. Everything else — retries, timeouts —
 * exists so that store can actually drain.
 *
 * The attempt budget is the one thing here that can destroy a photo, so it is
 * only ever spent on an answer from the server. A request that never left the
 * device is handed back: see `refund`.
 */

export const MAX_ATTEMPTS = 4
export const MAX_AGE_MS = 24 * 60 * 60 * 1000
/** After a failure, try again. Event listeners also wake the queue; this is
 *  the backup for when they fire too early (`online`) or not at all. */
export const RETRY_MS = 10_000

export const REQUEST_TIMEOUTS_MS = {
  reserve: 20_000,
  upload: 120_000,
  commit: 20_000,
}

export type UploadQueueDeps = {
  reserve: (idempotencyKey: string) => Promise<ReserveState>
  /**
   * Reduce one capture to the single blob worth keeping. Runs once, right
   * after the shutter — never again, however many times the shot is retried.
   */
  compress: (file: File) => Promise<CompressedCapture>
  /** The three renders for a stored shot, compressed or still raw. */
  prepare: (shot: StoredShot) => Promise<PreparedPhoto>
  upload: (args: {
    prepared: PreparedPhoto
    uploads: { full: SignedUpload; view: SignedUpload; thumb: SignedUpload }
    onProgress?: (fraction: number) => void
    signal?: AbortSignal
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
  now?: () => number
  schedule?: (run: () => void, delayMs: number) => () => void
  timeouts?: typeof REQUEST_TIMEOUTS_MS
}

export type UploadQueueHandlers = {
  /**
   * The server has granted the frame. Reported so the screen can match its
   * in-flight cell against the real photo when it comes down, rather than
   * against a count — uploads land out of order once one is deferred.
   */
  onReserved(id: string, photoId: string): void
  onProgress(id: string, fraction: number): void
  onConfirmed(id: string, shotsRemaining: number): void
  onDropped(id: string, reason: 'refused' | 'exhausted'): void
  onRefusal(refusal: ShotRefusal): void
  /**
   * One normalized diagnostic for every kind of upload problem. The screen
   * can deduplicate transient repeats without having to reconstruct which
   * queue callback meant which stage.
   */
  onIssue?(id: string, issue: UploadIssue): void
  /**
   * `settle` finished: the raw file is on disk and either the master replaced
   * it or compression failed and the raw row stays. The `File` is passed so the
   * screen can say what kind of input it was without the queue knowing.
   */
  onPrepared?(id: string, file: File, outcome: PreparedOutcome): void
  /**
   * A stored row was thrown away on resume without ever being tried in this
   * tab. `expired` is the age policy, `exhausted` the attempt budget, `empty` a
   * zero-byte blob. Each is a photo this device lost; nobody is told on screen,
   * because there is nothing they could do, but somebody should count them.
   */
  onDiscarded?(id: string, reason: DiscardReason, ageMs: number): void
  /**
   * A shot recovered from a killed tab, ready for its developing cell.
   *
   * A `Blob` rather than a `File` because in the common case it is the JPEG
   * master, not the camera's original — which also means the preview renders
   * on Android, where an object URL of a raw HEIC does not.
   */
  onRestored(entry: { id: string; blob: Blob; capturedAt: number }): void
}

/**
 * One shot the device still owes.
 *
 * The item *is* the row rather than a parallel copy of it: `shot` is handed
 * straight to `store.put`, so there is nowhere for memory and disk to drift.
 */
type QueueItem = {
  shot: StoredShot
  /**
   * The raw write and the compression that supersedes it. `enqueue` never
   * awaits this — the guest must not wait on a disk write or a decode to watch
   * their photo start developing — but no server call may overtake it.
   */
  settled: Promise<void> | null
}

export type DiscardReason = 'expired' | 'exhausted' | 'empty'
export type UploadStage = 'prepare' | 'reserve' | 'upload' | 'commit'
export type UploadIssue = {
  stage: UploadStage
  failure: string
  attempts: number
  terminal: boolean
}
export type PreparedOutcome =
  | { ok: true; ms: number; bytes: number; width: number; height: number }
  | { ok: false; ms: number; error: string }

export type UploadQueue = {
  enqueue(id: string, file: File, capturedAt: number): void
  resume(): Promise<void>
  drain(): Promise<void>
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
  const claimed = new Set<string>()
  let draining: Promise<void> | null = null
  let resuming = false
  let sweep: (() => void) | null = null
  let stopped = false
  let activeAbort: AbortController | null = null

  /**
   * Hand an attempt back.
   *
   * The bump is written *before* the attempt runs, because the failure that
   * matters most is a decode that takes the whole tab with it — counted
   * afterwards, that photo retries for ever and crashes the page on every load.
   * The cost of writing ahead is that a failure the server never saw counts
   * too. This is the correction, and it is applied only to that case.
   */
  async function refund(item: QueueItem) {
    item.shot.attempts = Math.max(0, item.shot.attempts - 1)
    // Safe against resurrection: every caller still owns the row. The paths
    // that delete it — commit, exhaustion, a terminal refusal — all return
    // without coming back through here.
    await deps.store.put(item.shot)
  }

  function enqueue(id: string, file: File, capturedAt: number) {
    if (stopped || claimed.has(id)) return
    claimed.add(id)
    const item: QueueItem = {
      shot: {
        id,
        eventId,
        // Raw for now. `settle` replaces it with the master in a moment.
        blob: file,
        compressed: false,
        takenAt: null,
        width: null,
        height: null,
        name: file.name,
        type: file.type,
        lastModified: file.lastModified,
        capturedAt,
        attempts: 0,
      },
      settled: null,
    }
    item.settled = settle(item, file)
    pending.push(item)
    void drain()
  }

  /**
   * Get the shot onto disk, then get it down to the bytes worth keeping.
   *
   * The order is the point. The raw file is written **before** the decode,
   * because the decode is where the tab dies: a 48MP HEIC is a ~50MB bitmap,
   * and a guest who taps the shutter again while this runs backgrounds the tab
   * holding it. Compressing first and persisting after would reopen exactly the
   * window this store was built to close.
   *
   * The raw row lives for the seconds that takes. After it, every retry and
   * every resume works from a ~2.2MB JPEG and libheif is never loaded again.
   */
  async function settle(item: QueueItem, file: File) {
    const started = clock()
    try {
      // Both writes and the decode sit under one catch: this promise is
      // awaited on the capture path, and a rejection there would surface as a
      // throw inside the drain loop rather than as a shot that simply has not
      // been compressed yet.
      await deps.store.put(item.shot)
      if (stopped) return

      const master = await deps.compress(file)
      item.shot.blob = master.blob
      item.shot.compressed = true
      item.shot.width = master.width
      item.shot.height = master.height
      item.shot.takenAt = master.takenAt?.toISOString() ?? null
      await deps.store.put(item.shot)
      const outcome: PreparedOutcome = {
        ok: true,
        ms: clock() - started,
        bytes: master.blob.size,
        width: master.width,
        height: master.height,
      }
      notify(() => handlers.onPrepared?.(item.shot.id, file, outcome))
    } catch (error) {
      // Leave the row exactly as it is. `prepare` handles an uncompressed shot
      // by running the original pipeline, so a failure here costs a decode per
      // attempt rather than the photo.
      console.error('Preparing a capture failed', error)
      const outcome: PreparedOutcome = {
        ok: false,
        ms: clock() - started,
        error: failureClass(error),
      }
      notify(() =>
        handlers.onIssue?.(item.shot.id, {
          stage: 'prepare',
          failure: outcome.error,
          attempts: item.shot.attempts,
          terminal: false,
        }),
      )
      notify(() => handlers.onPrepared?.(item.shot.id, file, outcome))
    }
  }

  function withTimeout<T>(
    work: (signal: AbortSignal) => Promise<T>,
    ms: number,
    what: string,
  ) {
    if (stopped) return Promise.reject(aborted())

    return new Promise<T>((resolve, reject) => {
      const controller = new AbortController()
      activeAbort = controller
      const timeoutError = new DOMException(`${what} timed out`, 'TimeoutError')
      const timer = setTimeout(() => {
        controller.abort(timeoutError)
        reject(timeoutError)
      }, ms)
      Promise.resolve()
        .then(() => work(controller.signal))
        .then(
          (value) => {
            clearTimeout(timer)
            if (activeAbort === controller) activeAbort = null
            resolve(value)
          },
          (error: unknown) => {
            clearTimeout(timer)
            if (activeAbort === controller) activeAbort = null
            reject(error)
          },
        )
    })
  }

  function scheduleSweep() {
    if (stopped || sweep !== null) return
    sweep = schedule(() => {
      sweep = null
      void resume()
    }, RETRY_MS)
  }

  function cancelSweep() {
    sweep?.()
    sweep = null
  }

  async function resume() {
    if (stopped || resuming) return
    resuming = true

    try {
      const at = clock()
      for (let i = pending.length - 1; i >= 0; i--) {
        const { shot } = pending[i]
        if (at - shot.capturedAt <= MAX_AGE_MS) continue
        pending.splice(i, 1)
        if (await deps.store.remove(shot.id)) claimed.delete(shot.id)
        notify(() => handlers.onDropped(shot.id, 'exhausted'))
      }

      for (const stored of await deps.store.listByEvent(eventId)) {
        if (claimed.has(stored.id)) continue
        const discard = discardReason(stored, at)
        if (discard) {
          await deps.store.remove(stored.id)
          const age = at - stored.capturedAt
          notify(() => handlers.onDiscarded?.(stored.id, discard, age))
          continue
        }
        claimed.add(stored.id)
        // The row is taken as it stands, compressed or not — `settle` has
        // already run in whatever tab wrote it, and a compressed row must
        // never be compressed twice.
        pending.push({ shot: stored, settled: null })
        notify(() =>
          handlers.onRestored({
            id: stored.id,
            blob: stored.blob,
            capturedAt: stored.capturedAt,
          }),
        )
      }

      pending.sort((a, b) => a.shot.capturedAt - b.shot.capturedAt)
    } finally {
      resuming = false
    }

    void drain()
  }

  function discardReason(stored: StoredShot, at: number): DiscardReason | null {
    if (stored.blob.size === 0) return 'empty'
    if (stored.attempts >= MAX_ATTEMPTS) return 'exhausted'
    if (at - stored.capturedAt > MAX_AGE_MS) return 'expired'
    return null
  }

  /**
   * One drain at a time, and the guard is cleared from outside the loop.
   *
   * This shipped as `draining ??= (async () => { … draining = null … })()`,
   * which is wrong in the one case that happens on every page load. An async
   * function body runs synchronously up to its first `await`, and a drain with
   * nothing to do never awaits: the body ran to completion and set the guard to
   * null *before* `??=` assigned the promise to it. So `draining` was left
   * holding a resolved promise for the life of the page, every later `drain()`
   * short-circuited, and a guest's first photo sat in IndexedDB until they
   * reloaded — which worked only because a reload has a stored row to await.
   *
   * A `.finally` callback is a microtask, so it cannot run before the
   * assignment below. Clearing the guard by identity rather than
   * unconditionally also means a stale loop cannot clear a newer one's.
   */
  function drain(): Promise<void> {
    if (stopped) return Promise.resolve()
    if (draining) return draining

    const run = drainLoop().finally(() => {
      if (draining === run) draining = null
    })
    draining = run
    return run
  }

  async function drainLoop(): Promise<void> {
    while (!stopped) {
      const item = pending.shift()
      if (!item) break
      let outcome: 'done' | 'retry' | 'stop'
      try {
        outcome = await runCapture(item)
      } catch (error) {
        // `runCapture` handles its own failures, so this is a handler throwing
        // into it. It must take neither the rest of the roll nor the sweep
        // decision below down with it — without the re-queue the shot would be
        // dropped from memory while its row stayed on disk.
        console.error('Upload handler failed', error)
        pending.unshift(item)
        break
      }
      if (outcome === 'retry') {
        pending.unshift(item)
        break
      }
      if (outcome === 'stop') break
    }

    if (stopped) return
    if (pending.length > 0) scheduleSweep()
    else cancelSweep()
  }

  async function dropAll(reason: 'refused' | 'exhausted') {
    const doomed = pending.splice(0, pending.length)
    for (const { shot } of doomed) {
      if (await deps.store.remove(shot.id)) claimed.delete(shot.id)
      notify(() => handlers.onDropped(shot.id, reason))
    }
  }

  async function runCapture(
    item: QueueItem,
  ): Promise<'done' | 'retry' | 'stop'> {
    // No server call may overtake the durable write, and none may run against
    // bytes that are about to be replaced.
    if (item.settled) {
      const settled = item.settled
      // Cleared *before* the await: a rejected promise stays rejected, so a
      // retry that awaited the same one again could never get past it.
      item.settled = null
      await settled
    }
    if (stopped) return 'retry'

    const { shot } = item
    shot.attempts += 1
    await deps.store.put(shot)

    let photoId: string | null = null
    let stage: UploadStage = 'reserve'

    try {
      const reserved = await withTimeout(
        () => deps.reserve(shot.id),
        limits.reserve,
        'Reserving a frame',
      )

      if (!reserved.ok) {
        if (reserved.refusal === 'ended' || reserved.refusal === 'no_shots') {
          const issue: UploadIssue = {
            stage: 'reserve',
            failure: `refusal_${reserved.refusal}`,
            attempts: shot.attempts,
            terminal: true,
          }
          notify(() => handlers.onIssue?.(shot.id, issue))
          if (await deps.store.remove(shot.id)) claimed.delete(shot.id)
          notify(() => handlers.onDropped(shot.id, 'refused'))
          await dropAll('refused')
          notify(() => handlers.onRefusal(reserved.refusal))
          return 'stop'
        }
        // `not_started`, `uploads_disabled`, `storage_limit`, `no_session`,
        // `error`: the server answered, but about itself rather than about this
        // photo. Spending the budget here retires a perfectly good shot for the
        // duration of an ops kill switch — and poisons its stored row, so the
        // next page load discards it on sight.
        await refund(item)
        notify(() =>
          handlers.onIssue?.(shot.id, {
            stage: 'reserve',
            failure: `refusal_${reserved.refusal}`,
            attempts: shot.attempts,
            terminal: false,
          }),
        )
        notify(() => handlers.onProgress(shot.id, 0))
        notify(() => handlers.onRefusal(reserved.refusal))
        return 'retry'
      }

      photoId = reserved.photoId
      notify(() => handlers.onReserved(shot.id, reserved.photoId))

      stage = 'prepare'
      const prepared = await deps.prepare(shot)
      stage = 'upload'
      await withTimeout(
        (signal) =>
          deps.upload({
            prepared,
            uploads: reserved.uploads,
            onProgress: (fraction) =>
              notify(() => handlers.onProgress(shot.id, fraction)),
            signal,
          }),
        limits.upload,
        'Uploading a photo',
      )

      stage = 'commit'
      const committed = await withTimeout(
        () =>
          deps.commit({
            photoId: reserved.photoId,
            width: prepared.width,
            height: prepared.height,
            byteSize: prepared.full.size,
            // EXIF first, the shutter press second. iOS hands a live capture
            // to the page with its EXIF stripped, so on most guests' phones
            // there is no timestamp in the file at all — and `taken_at` is
            // what the host's ZIP export sorts and stamps the album by. The
            // moment the camera returned the file is within seconds of the
            // shutter on a product with no gallery upload, and it is right
            // however long compression, the queue or a dead tab delayed the
            // upload. Never null from here on.
            takenAt:
              prepared.takenAt?.toISOString() ??
              new Date(shot.capturedAt).toISOString(),
          }),
        limits.commit,
        'Confirming a photo',
      )

      if (!committed.committed) throw new Error('commit refused')

      if (await deps.store.remove(shot.id)) claimed.delete(shot.id)
      notify(() => handlers.onConfirmed(shot.id, committed.shotsRemaining))
      return 'done'
    } catch (error) {
      console.error('Native camera upload failed', error)
      if (stopped) {
        await refund(item)
        return 'retry'
      }

      // Nothing left the device — no signal, or it dropped mid-request. Four
      // bad reconnects must not delete a photo that was never once sent.
      const unsent = isConnectionFailure(error)
      if (unsent) await refund(item)
      const terminal = !unsent && shot.attempts >= MAX_ATTEMPTS
      notify(() =>
        handlers.onIssue?.(shot.id, {
          stage,
          failure: unsent ? 'connection' : failureClass(error),
          attempts: shot.attempts,
          terminal,
        }),
      )

      if (terminal) {
        if (await deps.store.remove(shot.id)) claimed.delete(shot.id)
        notify(() => handlers.onDropped(shot.id, 'exhausted'))
        if (photoId) void deps.release(photoId)
        return 'done'
      }

      notify(() => handlers.onProgress(shot.id, 0))
      return 'retry'
    }
  }

  function notify(run: () => void) {
    if (stopped) return
    try {
      run()
    } catch (error) {
      console.error('Upload handler failed', error)
    }
  }

  function stop() {
    stopped = true
    cancelSweep()
    activeAbort?.abort(aborted())
    activeAbort = null
  }

  return { enqueue, resume, drain, stop }
}

function aborted() {
  return new DOMException('Upload queue stopped', 'AbortError')
}
