import { sendNextEventEmail } from '@/lib/email/send-event-email'
import { authorizeWorker, unauthorized } from '@/lib/exports/worker-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportServerEvent, reportServerIssue } from '@/lib/telemetry-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Called by pg_cron through pg_net every five minutes with the shared secret
 * read from Vault (`20260921061638_event_emails.sql`). pg_net never reads the
 * response, so — like the export and invoice sweeps — this reports its own
 * outcome as `event_email_sweep`, and no such event for an hour is the alert.
 *
 * The skip paths report too, carrying the reason. A schedule paused by
 * `OURFILM_EVENT_EMAILS` and a schedule that has stopped running look
 * identical from PostHog otherwise, and the first is the likelier accident.
 */
export async function POST(request: Request) {
  if (!authorizeWorker(request)) return unauthorized()

  const counts = { sent: 0, failed: 0 }
  // Explicit rollout switch also keeps previews from sending real host mail.
  if (process.env.OURFILM_EVENT_EMAILS !== 'true') {
    await reportServerEvent('event_email_sweep', {
      ...counts,
      skipped: 'event_emails_disabled',
    })
    return Response.json({ ok: true, skipped: 'event_emails_disabled' })
  }
  if (!process.env.RESEND_API_KEY) {
    await reportServerEvent('event_email_sweep', {
      ...counts,
      skipped: 'email_not_configured',
    })
    return Response.json({ error: 'email_not_configured' }, { status: 503 })
  }

  try {
    const db = createAdminClient()
    // Each provider request has a 10s deadline. Leave time for DB and reporting.
    for (let i = 0; i < 3; i++) {
      try {
        const outcome = await sendNextEventEmail(db)
        if (outcome === 'empty') break
        counts.sent++
      } catch (error) {
        counts.failed++
        await reportServerIssue(error, {
          operation: 'event_email_delivery',
          route: '/api/event-emails/sweep',
          routeType: 'route',
          method: 'POST',
        })
      }
    }
  } catch (error) {
    await reportServerIssue(error, {
      operation: 'event_email_sweep',
      route: '/api/event-emails/sweep',
      routeType: 'route',
      method: 'POST',
    })
    // A run that always throws must still leave a heartbeat, or the alert
    // reads as a stopped schedule rather than a failing one.
    await reportServerEvent('event_email_sweep', { ...counts, skipped: null })
    return Response.json({ error: 'sweep_failed' }, { status: 500 })
  }

  await reportServerEvent('event_email_sweep', { ...counts, skipped: null })
  return Response.json(
    { ok: counts.failed === 0, ...counts },
    { status: counts.failed ? 500 : 200 },
  )
}
