import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * The worker's whole configuration, read once.
 *
 * Deliberately short. The worker holds exactly one secret — the token that
 * authenticates it to the web app's export endpoints — and no Supabase key of
 * any kind: the URLs it reads are public objects and the upload it writes is
 * authorised by a token Vercel mints per job. Everything else here is tuning.
 */
export type Env = {
  apiUrl: string
  secret: string
  /**
   * Vercel's "Protection Bypass for Automation" secret, for pointing the
   * worker at a preview deployment. Previews sit behind Vercel Authentication,
   * which answers a worker's POST with a login page; this header lets the
   * request through without lowering protection for everyone. Unset in
   * production, where `ourfilm.app` is public.
   */
  protectionBypass: string | null
  tmpDir: string
  diskFloorBytes: number
  pollSeconds: number
  idleBackoffSeconds: number
  fetchConcurrency: number
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing ${name}. The worker needs OURFILM_API_URL (https://ourfilm.app) ` +
        `and EXPORT_WORKER_SECRET (the same value Vercel holds); see apps/worker/README.md.`,
    )
  }
  return value
}

function number(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number, got ${raw}`)
  }
  return value
}

export function readEnv(): Env {
  return {
    apiUrl: required('OURFILM_API_URL').replace(/\/+$/, ''),
    secret: required('EXPORT_WORKER_SECRET'),
    protectionBypass: process.env.VERCEL_PROTECTION_BYPASS || null,
    tmpDir: process.env.EXPORT_TMP_DIR || join(tmpdir(), 'ourfilm-exports'),
    // Two gigabytes of headroom below which no job is claimed: a wedding ZIP
    // is written in full before it is uploaded, and running out of disk
    // halfway through is a failure with no symptom until it has every symptom.
    diskFloorBytes: number('EXPORT_DISK_FLOOR_BYTES', 2 * 1024 ** 3),
    pollSeconds: number('EXPORT_POLL_SECONDS', 60),
    idleBackoffSeconds: number('EXPORT_IDLE_BACKOFF_SECONDS', 300),
    fetchConcurrency: Math.max(1, number('EXPORT_FETCH_CONCURRENCY', 8)),
  }
}

let cached: Env | null = null

/** The environment, validated on first use rather than at import time so a
 *  test can import a module without configuring a worker. */
export function env(): Env {
  cached ??= readEnv()
  return cached
}
