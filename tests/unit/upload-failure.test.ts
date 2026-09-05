/**
 * Which failures cost a guest a frame.
 *
 *     pnpm test
 *
 * One predicate, and one case worth the file on its own: a real network failure
 * does not look like a network error.
 *
 * `uploadToSignedUrl` never throws a `TypeError` at its caller. supabase
 * catches whatever `fetch` threw and wraps it in a `StorageUnknownError`, whose
 * own `name` is `'StorageUnknownError'` and whose `originalError` holds the
 * actual `TypeError` one level down. So the obvious check — the one every
 * is-this-a-network-error helper performs — is false for every genuine
 * connection failure this product will ever see.
 *
 * Get it wrong and nothing throws and nothing logs. The attempt is silently
 * spent, and four reconnects delete a photo that was never once sent. That is
 * why the wrapper is pinned here rather than left to a real phone.
 */
import { describe, expect, it } from 'vitest'

import { failureClass, isConnectionFailure } from '@/lib/upload-failure'

/** What supabase builds when the server answered. */
const api = (status: number) => ({
  name: 'StorageApiError',
  message: `HTTP ${status}`,
  status,
  statusCode: String(status),
})

/** What supabase builds when `fetch` itself threw. */
const wrapped = (originalError: unknown) => ({
  name: 'StorageUnknownError',
  message: 'Failed to fetch',
  originalError,
})

const unsent: [string, unknown][] = [
  // The whole point of the module. One of these per browser engine.
  ['wrapped Chrome network failure', wrapped(new TypeError('Failed to fetch'))],
  ['wrapped Safari network failure', wrapped(new TypeError('Load failed'))],
  [
    'wrapped Firefox network failure',
    wrapped(new TypeError('NetworkError when attempting to fetch resource.')),
  ],
  ['an unwrapped network TypeError', new TypeError('Failed to fetch')],
  ['undici, so a Server Action call', new TypeError('fetch failed')],
  // The queue's own ceiling on a request that never answered.
  [
    'a request that hung until the timeout',
    new DOMException('x', 'TimeoutError'),
  ],
]

const answered: [string, unknown][] = [
  // The server saw every one of these. Counting them is what the budget is
  // for — a photo Storage will never accept has to retire eventually.
  ['500 — Storage fell over', api(500)],
  ['503 — briefly unavailable', api(503)],
  ['429 — back-pressure', api(429)],
  ['401 — the signature did not verify', api(401)],
  ['404 — the path is gone', api(404)],
  ['the commit refusal the queue throws itself', new Error('commit refused')],
  // A programming mistake, not a dead connection. Refunding a bug for ever
  // would keep a broken photo in the queue until it aged out.
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

describe('isConnectionFailure', () => {
  it.each(unsent)('hands the attempt back: %s', (_name, error) => {
    expect(isConnectionFailure(error)).toBe(true)
  })

  it.each(answered)('spends the attempt: %s', (_name, error) => {
    expect(isConnectionFailure(error)).toBe(false)
  })
})

describe('naming a failure', () => {
  // Low cardinality on purpose: these become bars on a chart.
  it('names the queue deadlines and HTTP statuses', () => {
    expect(failureClass(new DOMException('slow', 'TimeoutError'))).toBe(
      'timeout',
    )
    expect(failureClass(new DOMException('gone', 'AbortError'))).toBe('aborted')
    expect(failureClass(Object.assign(new Error('x'), { status: 500 }))).toBe(
      'http_500',
    )
    expect(failureClass({ statusCode: '413', message: 'too large' })).toBe(
      'http_413',
    )
  })

  it('names the commit refusal and falls back to the error name', () => {
    expect(failureClass(new Error('commit refused'))).toBe('commit_refused')
    expect(failureClass(new RangeError('oom'))).toBe('rangeerror')
    expect(failureClass('nope')).toBe('unknown')
  })
})
