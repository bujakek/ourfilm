import 'server-only'

import { timingSafeEqual } from 'node:crypto'

/**
 * The one secret the worker holds, checked the one way that does not leak it.
 *
 * `EXPORT_WORKER_SECRET` is shared by Vercel, the Railway worker and the
 * pg_cron sweep job (through Vault). It authenticates every `/api/exports/*`
 * call; nothing else does, because the worker has no Supabase identity at all
 * — see §2.6 of docs/public-cdn-and-export-worker.md.
 */
export function authorizeWorker(request: Request): boolean {
  const expected = process.env.EXPORT_WORKER_SECRET
  if (!expected) return false

  const header = request.headers.get('authorization') ?? ''
  const presented = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!presented) return false

  const a = Buffer.from(presented)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Whether large albums go to the worker at all. Off, they stream through the
 *  function as before; on, they are queued. The cutover switch in §2.10. */
export function exportWorkerEnabled(): boolean {
  return process.env.OURFILM_EXPORT_WORKER === 'true'
}

export function unauthorized() {
  return Response.json({ error: 'unauthorized' }, { status: 401 })
}
