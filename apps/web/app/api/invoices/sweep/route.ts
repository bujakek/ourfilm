import {
  cancelBillingoInvoice,
  ensureBillingoInvoice,
} from '@/lib/billingo/invoicing'
import { billingoIsConfigured } from '@/lib/billingo/env'
import { authorizeWorker, unauthorized } from '@/lib/exports/worker-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportServerEvent, reportServerIssue } from '@/lib/telemetry-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/** Bounded per run: the schedule comes round again in five minutes, and a
 *  sweep that tries to clear a backlog in one call times out instead. */
const PURCHASES_PER_RUN = 10

/**
 * The retry the Stripe webhook cannot be.
 *
 * The webhook makes the first attempt at every Hungarian invoice, and it must
 * not be the only one. Stripe gives up retrying after three days, a 402 from
 * Billingo — the document quota on the API add-on — cannot be fixed by
 * retrying inside the hour, and a host who paid and never received an invoice
 * is a legal problem rather than a degraded feature.
 *
 * Called by pg_cron through pg_net every five minutes with the shared secret
 * read from Vault (`20260910140000_billingo_invoicing.sql`). pg_net never
 * reads the response, so this reports its own outcome as `invoice_sweep` — a
 * schedule with no such event for an hour is the alert.
 *
 * Every row it touches is claimed under a lease inside `ensureBillingoInvoice`
 * / `cancelBillingoInvoice`, so a run overlapping the webhook's own attempt
 * finds nothing to do rather than issuing a second document.
 */
export async function POST(request: Request) {
  if (!authorizeWorker(request)) return unauthorized()

  // A deployment with no Billingo keys sells no Hungarian events at all
  // (`checkoutIsConfigured`), so there is nothing here to retry and no reason
  // to report a failure every five minutes for ever.
  if (!billingoIsConfigured()) {
    return Response.json({ ok: true, skipped: 'billingo_not_configured' })
  }

  const db = createAdminClient()
  const counts = { considered: 0, issued: 0, cancelled: 0, failed: 0 }

  try {
    const { data: due, error } = await db
      .from('purchases')
      .select('id, invoice_status')
      .eq('settlement', 'direct')
      .in('invoice_status', [
        'pending',
        'failed',
        'send_failed',
        'blocked',
        'cancellation_pending',
      ])
      .lte('invoice_next_attempt_at', new Date().toISOString())
      // Oldest first, so a backlog drains in the order the money arrived
      // rather than starving the purchase that has been waiting longest.
      .order('invoice_next_attempt_at', { ascending: true })
      .limit(PURCHASES_PER_RUN)

    if (error) throw error

    counts.considered = due?.length ?? 0

    for (const row of due ?? []) {
      if (row.invoice_status === 'cancellation_pending') {
        const outcome = await cancelBillingoInvoice(db, row.id, 'sweep')
        if (outcome === 'cancelled') counts.cancelled += 1
        if (outcome === 'failed') counts.failed += 1
        continue
      }

      const outcome = await ensureBillingoInvoice(db, row.id, 'sweep')
      if (outcome === 'issued') counts.issued += 1
      if (outcome === 'failed') counts.failed += 1
    }
  } catch (e) {
    // The per-row calls never throw; reaching here means the query itself
    // failed, which is worth a 500 so the next run is not the only signal.
    console.error('Invoice sweep failed', e)
    await reportServerIssue(e, {
      operation: 'invoice_sweep',
      route: '/api/invoices/sweep',
      routeType: 'route',
      method: 'POST',
    })
    return Response.json({ error: 'sweep failed' }, { status: 500 })
  }

  await reportServerEvent('invoice_sweep', counts)
  return Response.json({ ok: true, ...counts })
}
