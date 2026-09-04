import pRetry, { type Options } from 'p-retry'

/**
 * What is worth sending again, and what is not.
 *
 * Only the **transport** retries. Business refusals never reach this file at
 * all: `reserveShotAction` returns `{ ok: false, refusal }` as a *value*, so the
 * queue branches on `no_shots` or `ended` before a single byte moves. That is a
 * stronger guarantee than a classifier rule, because there is no code path on
 * which a refusal could be misread as a network blip and retried.
 *
 * ## The trap this module exists to avoid
 *
 * A network failure does not look like a network error. `uploadToSignedUrl`
 * *returns* `{ data: null, error }` for anything supabase recognises as a
 * storage error, and the two shapes it produces are:
 *
 * - `StorageApiError` — the server answered. Carries a numeric `status`.
 * - `StorageUnknownError` — `fetch` itself threw. Its own `name` is
 *   `'StorageUnknownError'`, and the real `TypeError` is wrapped one level down
 *   in **`originalError`**.
 *
 * So the obvious check — `error.name === 'TypeError'`, which is what every
 * is-this-a-network-error helper does — is `false` for every genuine network
 * failure this product will ever see. The wrapper has to be unwrapped first.
 * Get that wrong and nothing throws and nothing logs; retries simply never
 * fire, which is indistinguishable from the bug this feature was built to fix.
 *
 * Classification is **duck-typed**, never `instanceof`. supabase duck-types its
 * own errors (`'__isStorageError' in error`) for the same reason: pnpm and
 * Turbopack can leave two copies of `storage-js` in a graph, and an `instanceof`
 * against the wrong copy fails silently.
 */

/** How many times one render's PUT is sent before the shot is handed back. */
export const TRANSFER_RETRIES = 2

export const transferRetryOptions: Options = {
  retries: TRANSFER_RETRIES,
  factor: 2,
  minTimeout: 700,
  maxTimeout: 4000,
  /**
   * A wedding is a hundred phones behind one access point. Without jitter they
   * all fail together, wait the same 700ms and retry together — which is the
   * congestion that caused the failure, reproduced on a timer.
   */
  randomize: true,
  /**
   * A ceiling on the whole sequence. The guest is inside the OS camera while
   * this runs, and a phone holding a signed token open for minutes on a dead
   * network is worse than an honest failure it can retry by shooting again.
   */
  maxRetryTime: 25_000,
  shouldRetry: ({ error }) => isTransientUploadError(error),
}

/**
 * Retry one transfer. The body must throw to fail — `uploadToSignedUrl` returns
 * its error instead, so the caller converts before handing it over.
 */
export function retryTransfer<T>(run: () => Promise<T>): Promise<T> {
  return pRetry(run, transferRetryOptions)
}

/**
 * Whether sending the same bytes again could plausibly work.
 *
 * Transient means the network or the far end, not the request: a 5xx, a
 * timeout, rate limiting, or a connection that never completed. Everything else
 * is terminal, including anything unrecognisable — an error this cannot read is
 * an error it cannot claim will pass next time.
 */
export function isTransientUploadError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false

  const candidate = error as {
    status?: unknown
    name?: unknown
    originalError?: unknown
  }

  // The server answered. Only its own failures and its back-pressure codes are
  // worth repeating — a 400 with a bad token, a 401/403 on an expired
  // signature or a 404 on a vanished path will answer the same way forever.
  if (typeof candidate.status === 'number') {
    const { status } = candidate
    return status >= 500 || status === 408 || status === 429
  }

  // The wrapper. This is the branch the whole module is written for.
  if ('originalError' in candidate) {
    return isConnectionFailure(candidate.originalError)
  }

  return isConnectionFailure(error)
}

/**
 * A connection that never completed — nothing left the device.
 *
 * Narrower than `isTransientUploadError`, and the difference matters to the
 * queue's attempt budget: a 500 means the server saw the request and failed it,
 * which is worth counting, while this means the request never arrived anywhere
 * and counting it would let a walk out of wifi range spend a photo's last try.
 *
 * `fetch` reports every one of these as a bare `TypeError` whose message is the
 * only thing distinguishing it from a programming mistake, and each engine
 * words it differently — Chrome says "Failed to fetch", Safari "Load failed",
 * Firefox "NetworkError when attempting to fetch resource". Matching the
 * message is unpleasant and unavoidable; matching `TypeError` alone would
 * retry genuine bugs, and a bug retried three times is still a bug.
 */
export function isConnectionFailure(error: unknown): boolean {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'TimeoutError' || error.name === 'NetworkError'
  }

  if (typeof error !== 'object' || error === null) return false

  const { name, message } = error as { name?: unknown; message?: unknown }
  if (name !== 'TypeError' || typeof message !== 'string') return false

  return NETWORK_MESSAGES.some((fragment) =>
    message.toLowerCase().includes(fragment),
  )
}

const NETWORK_MESSAGES = [
  'failed to fetch', // Chrome, Edge
  'load failed', // Safari
  'networkerror', // Firefox
  'network request failed',
  'connection', // "connection closed", "connection refused"
  'terminated', // undici, which is what a Node-side fetch reports
]
