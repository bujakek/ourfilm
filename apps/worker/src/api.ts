import type {
  ClaimResponse,
  CompleteResponse,
  FailRequest,
  HeartbeatRequest,
  HeartbeatResponse,
} from '@ourfilm/shared/export-job'

import { env } from './env.ts'

/**
 * The four calls the worker makes, all to the web app and nowhere else.
 *
 * The worker never talks to Supabase directly: the database is behind these
 * endpoints, and the only other things it ever contacts are public photo
 * URLs and the one upload it was handed a token for. That is what keeps a
 * Railway container from being a second service with read access to every
 * album.
 *
 * Every call has a timeout. A hung request would otherwise hold a lease open
 * with no heartbeat behind it, and the sweep would re-queue a job whose
 * worker is still alive and merely stuck.
 */

const TIMEOUT_MS = 30_000
const RETRY_DELAYS_MS = [500, 2_000]

export class ApiError extends Error {
  // Explicit fields rather than constructor parameter properties: the worker
  // runs under `node --experimental-strip-types`, which strips types and
  // refuses any syntax that would need transforming.
  readonly status: number
  readonly path: string

  constructor(status: number, path: string, body: string) {
    super(`${path} answered ${status}: ${body.slice(0, 200)}`)
    this.name = 'ApiError'
    this.status = status
    this.path = path
  }
}

async function post(path: string, body: unknown): Promise<Response> {
  const { apiUrl, secret, protectionBypass } = env()
  let lastError: unknown
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      return await fetch(`${apiUrl}${path}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${secret}`,
          'content-type': 'application/json',
          accept: 'application/json',
          // Only ever set for a preview deployment; see `Env.protectionBypass`.
          ...(protectionBypass
            ? { 'x-vercel-protection-bypass': protectionBypass }
            : {}),
        },
        body: JSON.stringify(body ?? {}),
        signal: controller.signal,
      })
    } catch (error) {
      // Only a request that never got an answer is retried. A response, even
      // a 5xx, is an answer, and the endpoint owns what to do with it.
      lastError = error
      const delay = RETRY_DELAYS_MS[attempt]
      if (delay === undefined) break
      await new Promise((r) => setTimeout(r, delay))
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`network failure calling ${path}`)
}

async function json<T>(path: string, response: Response): Promise<T> {
  const text = await response.text()
  if (!response.ok) throw new ApiError(response.status, path, text)
  return JSON.parse(text) as T
}

/** Ask for work. `null` when the queue is empty. */
export async function claim(): Promise<ClaimResponse['job']> {
  const path = '/api/exports/claim'
  const response = await post(path, {})
  if (response.status === 204) return null
  const answer = await json<ClaimResponse>(path, response)
  return answer.job
}

/**
 * Extend the lease, and record the resumable upload once there is one. A
 * `false` answer means the job is no longer ours — re-claimed after a lapsed
 * lease, or gone with a deleted event — and the caller must stop.
 */
export async function heartbeat(
  exportId: string,
  body: HeartbeatRequest,
): Promise<HeartbeatResponse> {
  const path = `/api/exports/${exportId}/heartbeat`
  const response = await post(path, body)
  return json<HeartbeatResponse>(path, response)
}

/** The archive is uploaded. The server reads the object back itself. */
export async function complete(
  exportId: string,
  body: { missingCount: number },
): Promise<CompleteResponse> {
  const path = `/api/exports/${exportId}/complete`
  const response = await post(path, body)
  return json<CompleteResponse>(path, response)
}

/** This attempt is over. The server decides whether there is another. */
export async function fail(exportId: string, body: FailRequest): Promise<void> {
  const path = `/api/exports/${exportId}/fail`
  const response = await post(path, body)
  await json<unknown>(path, response)
}
