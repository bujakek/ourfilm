import type {
  HeartbeatRequest,
  HeartbeatResponse,
} from '@ourfilm/shared/export-job'

import { LEASE_INTERVAL } from '@/lib/exports/jobs'
import { authorizeWorker, unauthorized } from '@/lib/exports/worker-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID = /^[0-9a-f-]{36}$/i

/**
 * The worker is still working. Extends the lease, and records the resumable
 * upload URL once tus has assigned one so a re-claimed job continues from the
 * server's offset. `ok: false` means the job is no longer this worker's — the
 * lease lapsed and the sweep handed it on, or the event was deleted — and the
 * worker stops rather than completing a job somebody else now owns.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!authorizeWorker(request)) return unauthorized()
  const { id } = await params
  if (!UUID.test(id)) return Response.json({ error: 'bad_id' }, { status: 400 })

  const body = (await request.json().catch(() => ({}))) as HeartbeatRequest
  const url =
    typeof body.tusUploadUrl === 'string' && body.tusUploadUrl.length < 2048
      ? body.tusUploadUrl
      : null

  const db = createAdminClient()
  const { data: ok, error } = await db.rpc('heartbeat_album_export', {
    p_id: id,
    p_lease: LEASE_INTERVAL,
    p_tus_upload_url: url ?? undefined,
  })
  if (error) return Response.json({ error: 'unavailable' }, { status: 500 })

  const answer: HeartbeatResponse = ok
    ? { ok: true }
    : { ok: false, reason: 'not_in_progress' }
  return Response.json(answer, { status: ok ? 200 : 409 })
}
