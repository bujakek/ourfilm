import type { CompleteResponse } from '@ourfilm/shared/export-job'
import { after } from 'next/server'

import { sendExportReadyEmail } from '@/lib/exports/email'
import { storedObjectSize } from '@/lib/exports/jobs'
import { authorizeWorker, unauthorized } from '@/lib/exports/worker-auth'
import { exportStoragePath } from '@/lib/storage'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportServerEvent, reportServerIssue } from '@/lib/telemetry-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID = /^[0-9a-f-]{36}$/i

/**
 * The worker says it is done. Vercel checks.
 *
 * `complete` carries only `missingCount`; the size comes from reading the
 * object back through the Storage API. A worker that died mid-upload and
 * retried this call cannot talk a half-written archive into `ready`: a
 * resumable upload that has not received its last chunk is not an object
 * yet, so the read finds nothing and the job goes back to the queue.
 *
 * The email is sent after the response, never on it. A mail outage must not
 * fail a finished export; the sweep retries what did not go out.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!authorizeWorker(request)) return unauthorized()
  const { id } = await params
  if (!UUID.test(id)) return Response.json({ error: 'bad_id' }, { status: 400 })

  const body = (await request.json().catch(() => ({}))) as {
    missingCount?: unknown
  }
  const missingCount =
    typeof body.missingCount === 'number' && body.missingCount >= 0
      ? Math.floor(body.missingCount)
      : 0

  const db = createAdminClient()
  const { data: row, error } = await db
    .from('album_exports')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) return Response.json({ error: 'unavailable' }, { status: 500 })
  if (!row || row.status !== 'processing') {
    const answer: CompleteResponse = { ok: false, reason: 'not_in_progress' }
    return Response.json(answer)
  }

  const path = exportStoragePath(row.event_id, row.id)
  let size: number | null
  try {
    size = await storedObjectSize(db, path)
  } catch (e) {
    await reportServerIssue(e, {
      operation: 'album_export_complete',
      eventId: row.event_id,
      route: '/api/exports/[id]/complete',
      routeType: 'route',
      method: 'POST',
    })
    return Response.json({ error: 'unavailable' }, { status: 500 })
  }

  if (size === null || size === 0) {
    // Nothing at the path. Hand the job back with its retry so the next claim
    // builds it again; the worker, told `ok: false`, does nothing further.
    await db.rpc('fail_album_export', {
      p_id: row.id,
      p_code: 'object_missing',
      p_retry: true,
    })
    const answer: CompleteResponse = { ok: false, reason: 'object_missing' }
    return Response.json(answer)
  }

  const { data: ready, error: completeError } = await db.rpc(
    'complete_album_export',
    {
      p_id: row.id,
      p_storage_path: path,
      p_byte_size: size,
      p_missing_count: missingCount,
    },
  )
  if (completeError || !ready?.id) {
    // Lost the race with the lease: the sweep re-queued it a moment ago and
    // another worker may already hold it. Not this worker's any more.
    const answer: CompleteResponse = { ok: false, reason: 'not_in_progress' }
    return Response.json(answer)
  }

  await reportServerEvent('album_export_finished', {
    event_id: ready.event_id,
    photo_count: ready.photo_count,
    missing_count: ready.missing_count,
    hidden_count: null,
    elapsed_ms: ready.started_at
      ? Date.parse(ready.completed_at ?? '') - Date.parse(ready.started_at)
      : 0,
    mode: 'worker',
  })

  after(() => sendExportReadyEmail(db, ready))

  const answer: CompleteResponse = { ok: true }
  return Response.json(answer)
}
