import { MAX_NOTIFY_ATTEMPTS, sendExportReadyEmail } from '@/lib/exports/email'
import { authorizeWorker, unauthorized } from '@/lib/exports/worker-auth'
import { EXPORT_BUCKET } from '@/lib/storage'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportServerEvent, reportServerIssue } from '@/lib/telemetry-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/** Bounded per run: the schedule comes round again in five minutes, and a
 *  sweep that tries to do a year's backlog in one call times out instead. */
const OBJECTS_PER_RUN = 50
const ORPHAN_FOLDERS_PER_RUN = 25
const EMAILS_PER_RUN = 20

/**
 * The half of the housekeeping that needs the Storage API and Resend.
 *
 * Called by pg_cron through pg_net every five minutes with the shared secret
 * read from Vault (`20260909110000_album_exports.sql`); never by the worker,
 * whose death must not also silence the email retry. pg_net never reads the
 * response, so this reports its own outcome as `album_export_sweep` — a
 * schedule with no such event for an hour is the alert.
 *
 * Three jobs, each bounded and each safe to repeat:
 *   1. the SQL sweep (expire, release lapsed leases) — harmless to run again
 *      a minute after the cron's own SQL job did;
 *   2. delete the objects of expired and failed rows, and orphans: a ZIP
 *      whose event was deleted mid-run has no row left to expire it;
 *   3. send the export-ready mail for every `ready` row still unnotified.
 * Objects are deleted through the Storage API, never via SQL — deleting only
 * the metadata row orphans the file.
 */
export async function POST(request: Request) {
  if (!authorizeWorker(request)) return unauthorized()
  const db = createAdminClient()
  const counts = {
    expired: 0,
    released: 0,
    failed: 0,
    objects_removed: 0,
    orphans_removed: 0,
    emails_sent: 0,
    emails_failed: 0,
  }

  try {
    const { data: swept } = await db.rpc('sweep_album_exports').single()
    if (swept) {
      counts.expired = swept.expired
      counts.released = swept.released
      counts.failed = swept.failed
    }

    // 2a. Objects that belong to rows nobody can download any more.
    const { data: stale } = await db
      .from('album_exports')
      .select('id, storage_path')
      .in('status', ['expired', 'failed'])
      .not('storage_path', 'is', null)
      .limit(OBJECTS_PER_RUN)
    if (stale && stale.length > 0) {
      const paths = stale.map((r) => r.storage_path!).filter(Boolean)
      const { data: removed, error } = await db.storage
        .from(EXPORT_BUCKET)
        .remove(paths)
      if (error) throw error
      const gone = new Set((removed ?? []).map((o) => o.name))
      // Clear the path only for what actually went, so a path that survived
      // is retried next run rather than forgotten. `remove` also omits paths
      // that were already absent; treat those as gone too.
      const cleared = stale.filter(
        (r) => gone.has(r.storage_path!) || !(removed ?? []).length,
      )
      for (const r of cleared) {
        await db
          .from('album_exports')
          .update({ storage_path: null })
          .eq('id', r.id)
      }
      counts.objects_removed = gone.size
    }

    // 2b. Orphans: folders in the bucket with no row behind them. The layout
    // is `{eventId}/{exportId}/ourfilm.zip`, so a folder name is an export id
    // to look up.
    const { data: eventFolders } = await db.storage
      .from(EXPORT_BUCKET)
      .list('', { limit: ORPHAN_FOLDERS_PER_RUN })
    for (const folder of eventFolders ?? []) {
      if (folder.id !== null) continue // a stray root object; not ours
      const { data: exportsInFolder } = await db.storage
        .from(EXPORT_BUCKET)
        .list(folder.name, { limit: 100 })
      const exportIds = (exportsInFolder ?? [])
        .filter((o) => o.id === null)
        .map((o) => o.name)
      if (exportIds.length === 0) continue
      const { data: rows } = await db
        .from('album_exports')
        .select('id')
        .in('id', exportIds)
      const known = new Set((rows ?? []).map((r) => r.id))
      const orphans = exportIds.filter((id) => !known.has(id))
      if (orphans.length === 0) continue
      const { data: removed } = await db.storage
        .from(EXPORT_BUCKET)
        .remove(orphans.map((id) => `${folder.name}/${id}/ourfilm.zip`))
      counts.orphans_removed += removed?.length ?? 0
    }

    // 3. The email retry. Only rows still worth mailing: ready, unexpired,
    // unnotified, attempts left.
    const { data: unsent } = await db
      .from('album_exports')
      .select('*')
      .eq('status', 'ready')
      .is('notified_at', null)
      .lt('notify_attempts', MAX_NOTIFY_ATTEMPTS)
      .gt('expires_at', new Date().toISOString())
      .order('completed_at', { ascending: true })
      .limit(EMAILS_PER_RUN)
    for (const row of unsent ?? []) {
      const outcome = await sendExportReadyEmail(db, row)
      if (outcome === 'sent') counts.emails_sent += 1
      if (outcome === 'failed') counts.emails_failed += 1
    }
  } catch (e) {
    await reportServerIssue(e, {
      operation: 'album_export_sweep',
      route: '/api/exports/sweep',
      routeType: 'route',
      method: 'POST',
    })
    await reportServerEvent('album_export_sweep', counts)
    return Response.json({ ok: false, ...counts }, { status: 500 })
  }

  await reportServerEvent('album_export_sweep', counts)
  return Response.json({ ok: true, ...counts })
}
