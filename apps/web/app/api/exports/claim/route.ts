import type { ClaimResponse } from '@ourfilm/shared/export-job'

import { buildExportJob, LEASE_INTERVAL } from '@/lib/exports/jobs'
import { authorizeWorker, unauthorized } from '@/lib/exports/worker-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportServerEvent, reportServerIssue } from '@/lib/telemetry-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * The worker asks for work.
 *
 * One atomic claim (`claim_album_export`, `for update skip locked`), then the
 * payload: the manifest built from the rows as they stand now, one signed
 * upload token for the archive's exact path, and the lease's timing. The
 * worker receives no ids it could use for anything else and no credential of
 * any kind — see §2.3 of docs/public-cdn-and-export-worker.md.
 *
 * 204 when there is nothing to do, which is most of the time: the worker
 * polls every minute and backs off when idle.
 */
export async function POST(request: Request) {
  if (!authorizeWorker(request)) return unauthorized()

  const db = createAdminClient()
  const { data: row, error } = await db.rpc('claim_album_export', {
    p_lease: LEASE_INTERVAL,
  })
  if (error) {
    await reportServerIssue(error, {
      operation: 'album_export_claim',
      route: '/api/exports/claim',
      routeType: 'route',
      method: 'POST',
    })
    return Response.json({ error: 'unavailable' }, { status: 500 })
  }
  if (!row?.id) return new Response(null, { status: 204 })

  let job
  try {
    job = await buildExportJob(db, row)
  } catch (e) {
    // Building the payload failed — Storage would not sign, the read threw.
    // Hand the job back rather than leaving it to time out: the lease is what
    // would otherwise decide, ten minutes from now.
    await db.rpc('fail_album_export', {
      p_id: row.id,
      p_code: 'claim_failed',
      p_retry: true,
    })
    await reportServerIssue(e, {
      operation: 'album_export_claim',
      eventId: row.event_id,
      route: '/api/exports/claim',
      routeType: 'route',
      method: 'POST',
    })
    return new Response(null, { status: 204 })
  }

  if (!job) {
    // The event vanished between request and claim, or has no photos left.
    // Nothing to build, and nothing a retry would change.
    await db.rpc('fail_album_export', {
      p_id: row.id,
      p_code: 'event_missing',
      p_retry: false,
    })
    return new Response(null, { status: 204 })
  }

  await reportServerEvent('album_export_started', {
    event_id: row.event_id,
    photo_count: job.manifest.entries.length,
    mode: 'worker',
    attempt: row.attempt_count,
  })

  const body: ClaimResponse = { job }
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' } })
}
