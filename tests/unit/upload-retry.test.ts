/**
 * What the uploader will and will not send again.
 *
 *     pnpm test
 *
 * The interesting half of this file is one case: a real network failure does
 * not look like a network error.
 *
 * `uploadToSignedUrl` never throws a `TypeError` at its caller. supabase
 * catches whatever `fetch` threw and wraps it in a `StorageUnknownError`, whose
 * own `name` is `'StorageUnknownError'` and whose `originalError` holds the
 * actual `TypeError` one level down. So the obvious check — the one every
 * is-this-a-network-error helper performs, `error.name === 'TypeError'` — is
 * false for every genuine connection failure this product will ever see.
 *
 * Get that wrong and nothing throws and nothing logs. Retries simply never
 * fire, which looks exactly like the bug the retry was added to fix. That is
 * why the wrapper case is pinned here rather than left to a real phone.
 */
import { describe, expect, it } from 'vitest'

import {
  isTransientUploadError,
  transferRetryOptions,
  TRANSFER_RETRIES,
} from '@/lib/upload-retry'

/** The shape supabase builds when the server answered. */
const api = (status: number) => ({
  name: 'StorageApiError',
  message: `HTTP ${status}`,
  status,
  statusCode: String(status),
})

/** The shape supabase builds when `fetch` itself threw. */
const wrapped = (originalError: unknown) => ({
  name: 'StorageUnknownError',
  message: 'Failed to fetch',
  originalError,
})

const transient: [string, unknown][] = [
  ['500 — Storage fell over', api(500)],
  ['502 — a gateway in front of it did', api(502)],
  ['503 — briefly unavailable', api(503)],
  ['504 — the upstream timed out', api(504)],
  ['408 — the request timed out', api(408)],
  ['429 — back-pressure, not refusal', api(429)],
  // The whole point of the module. One of these per browser engine.
  ['wrapped Chrome network failure', wrapped(new TypeError('Failed to fetch'))],
  ['wrapped Safari network failure', wrapped(new TypeError('Load failed'))],
  [
    'wrapped Firefox network failure',
    wrapped(new TypeError('NetworkError when attempting to fetch resource.')),
  ],
  ['an unwrapped network TypeError', new TypeError('Failed to fetch')],
]

const terminal: [string, unknown][] = [
  // A signed token the database minted for one exact path. None of these
  // answers changes by being asked again.
  ['400 — malformed or spent token', api(400)],
  ['401 — the signature did not verify', api(401)],
  ['403 — the token is not for this path', api(403)],
  ['404 — the path is gone', api(404)],
  ['409 — a conflict, though upsert makes this unlikely', api(409)],
  // The commit refusal the queue throws itself. Sending bytes again cannot
  // change what the database said about the row.
  ['a plain Error from our own code', new Error('commit refused')],
  // A TypeError that is a programming mistake, not a dead connection. Retrying
  // a bug three times leaves a bug.
  ['a genuine TypeError', new TypeError('x.map is not a function')],
  [
    'a wrapped error that is not a network failure',
    wrapped(new RangeError('x')),
  ],
  ['null', null],
  ['undefined', undefined],
  ['a bare string', 'boom'],
  ['an empty object', {}],
]

describe('isTransientUploadError', () => {
  it.each(transient)('retries: %s', (_name, error) => {
    expect(isTransientUploadError(error)).toBe(true)
  })

  it.each(terminal)('gives up on: %s', (_name, error) => {
    expect(isTransientUploadError(error)).toBe(false)
  })
})

describe('the retry budget', () => {
  it('sends a render three times and no more', () => {
    // Not p-retry's default of 10. A guest is inside the OS camera while this
    // runs; ten attempts at a one-second floor is minutes of a phone holding a
    // signed token open on a network that is not coming back.
    expect(transferRetryOptions.retries).toBe(TRANSFER_RETRIES)
    expect(TRANSFER_RETRIES).toBe(2)
  })

  it('jitters, because a wedding is a hundred phones on one access point', () => {
    // Without this they fail together, wait the same 700ms, and retry together
    // — reproducing the congestion that caused the failure, on a timer.
    expect(transferRetryOptions.randomize).toBe(true)
  })

  it('caps the whole sequence rather than only each wait', () => {
    expect(transferRetryOptions.maxRetryTime).toBeLessThanOrEqual(30_000)
  })

  it('asks the classifier rather than retrying everything', () => {
    const shouldRetry = transferRetryOptions.shouldRetry
    expect(shouldRetry).toBeTypeOf('function')
    const context = {
      attemptNumber: 1,
      retriesLeft: 2,
      retriesConsumed: 0,
      retryDelay: 0,
    }
    expect(
      shouldRetry?.({ ...context, error: api(503) as unknown as Error }),
    ).toBe(true)
    expect(
      shouldRetry?.({ ...context, error: api(403) as unknown as Error }),
    ).toBe(false)
  })
})
