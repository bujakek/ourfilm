import type { FailRequest } from '@ourfilm/shared/export-job'

import { authorizeWorker, unauthorized } from '@/lib/exports/worker-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportServerEvent } from '@/lib/telemetry-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID = /^[0-9a-f-]{36}$/i
const CODES = new Set([
  'disk_full',
  'fetch_failed',
  'zip_failed',
  'upload_failed',
  'lease_lost',
  'unknown',
])

/**
 * The worker gave up on this attempt. The server owns the budget — the RPC
 * decides between a delayed retry and a final failure from `attempt_count`
 * — and the worker only says whether the failure looked transient.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!authorizeWorker(request)) return unauthorized()
  const { id } = await params
  if (!UUID.test(id)) return Response.json({ error: 'bad_id' }, { status: 400 })

  const body = (await request.json().catch(() => ({}))) as Partial<FailRequest>
  const code =
    typeof body.code === 'string' && CODES.has(body.code)
      ? body.code
      : 'unknown'
  const retry = body.retry === true

  const db = createAdminClient()
  const { data: row, error } = await db.rpc('fail_album_export', {
    p_id: id,
    p_code: code,
    p_retry: retry,
  })
  if (error) {
    // Not in progress any more: already re-queued by the sweep, or gone with
    // its event. Nothing to record; the worker stops either way.
    return Response.json({ ok: false, reason: 'not_in_progress' })
  }

  if (row?.id) {
    await reportServerEvent('album_export_failed', {
      event_id: row.event_id,
      code,
      attempt: row.attempt_count,
      final: row.status === 'failed',
    })
  }
  return Response.json({ ok: true })
}
