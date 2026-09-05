/**
 * Did this failure ever reach the server?
 *
 * One question, and the queue's attempt budget turns on it. That budget exists
 * to retire a photo the server keeps refusing — four goes and the bytes are
 * dropped. A request that never left the device has told us nothing about the
 * photo, so spending an attempt on it means a guest who walks into a marquee
 * for forty seconds loses a frame they cannot retake.
 *
 * ## The trap this module exists for
 *
 * A network failure does not look like a network error. `uploadToSignedUrl`
 * *returns* `{ data: null, error }` for anything supabase recognises, and the
 * two shapes it produces are:
 *
 * - `StorageApiError` — the server answered. Carries a numeric `status`.
 * - `StorageUnknownError` — `fetch` itself threw. Its own `name` is
 *   `'StorageUnknownError'`, and the real `TypeError` sits one level down in
 *   **`originalError`**.
 *
 * So the obvious check — `error.name === 'TypeError'`, which is what every
 * is-this-a-network-error helper does — is `false` for every genuine connection
 * failure this product will ever see. The wrapper has to be unwrapped first,
 * and getting it wrong throws nothing and logs nothing: the attempt is silently
 * spent and the photo is silently deleted four goes later.
 *
 * Classification is **duck-typed**, never `instanceof`. supabase duck-types its
 * own errors (`'__isStorageError' in error`) for the same reason: pnpm and
 * Turbopack can leave two copies of `storage-js` in one graph, and an
 * `instanceof` against the wrong copy fails silently.
 */

/**
 * Whether nothing left the device.
 *
 * A 5xx is deliberately **not** one of these. The server saw the request and
 * failed it, which is exactly what the budget is for; treating it as free would
 * leave a photo Storage will never accept retrying until it aged out.
 *
 * `fetch` reports every genuine connection failure as a bare `TypeError` whose
 * message is the only thing separating it from a programming mistake, and each
 * engine words it differently — Chrome "Failed to fetch", Safari "Load failed",
 * Firefox "NetworkError when attempting to fetch resource". Matching on the
 * message is unpleasant and unavoidable: matching `TypeError` alone would
 * refund genuine bugs for ever, and the photo would never retire.
 */
/**
 * A short, low-cardinality name for a failure the server *did* answer, for
 * telemetry. `timeout` and `aborted` are the queue's own deadlines; `http_500`
 * is Storage or the action; `commit_refused` is `commit_shot` saying no. The
 * rest fall back to the error's own name, lowercased, so a new failure shows
 * up as a new bar rather than as `unknown`.
 */
export function failureClass(error: unknown): string {
  if (error instanceof DOMException || isNamed(error)) {
    const name = String((error as { name?: unknown }).name ?? '')
    if (name === 'TimeoutError') return 'timeout'
    if (name === 'AbortError') return 'aborted'
  }
  const status = statusOf(error)
  if (status !== null) return `http_${status}`
  if (error instanceof Error) {
    if (error.message === 'commit refused') return 'commit_refused'
    return error.name ? error.name.toLowerCase() : 'error'
  }
  return 'unknown'
}

function isNamed(error: unknown): error is { name: unknown } {
  return typeof error === 'object' && error !== null && 'name' in error
}

function statusOf(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null
  for (const key of ['status', 'statusCode'] as const) {
    const value = (error as Record<string, unknown>)[key]
    if (typeof value === 'number') return value
    if (typeof value === 'string' && /^\d{3}$/.test(value)) return Number(value)
  }
  return null
}

export function isConnectionFailure(error: unknown): boolean {
  // The queue's own ceiling on a hung request, thrown with the shape a browser
  // uses. A request that never answered never got an answer to spend.
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'TimeoutError' || error.name === 'NetworkError'
  }

  if (typeof error !== 'object' || error === null) return false

  // The supabase wrapper. This is the branch the whole module is written for,
  // and it shipped missing once already: a PUT that died with the connection
  // was refunded never, while the same error one call up was read correctly.
  if ('originalError' in error) {
    return isConnectionFailure(
      (error as { originalError: unknown }).originalError,
    )
  }

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
  'fetch failed', // undici, so what a Server Action call reports
  'connection', // "connection closed", "connection refused"
  'terminated', // undici again
]
