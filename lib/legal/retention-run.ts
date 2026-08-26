import 'server-only'

import { eventUrl } from '@/lib/site'
import { createAdminClient } from '@/lib/supabase/admin'
import { purgeEventObjects } from '@/lib/event-purge'
import { retentionDates } from '@/lib/retention'

import { RETENTION_EMAIL_SUBJECT, retentionEmailBody } from './copy/retention'
import { createLegalClient } from './db'
import { sendDurableEmail } from './email'

/**
 * One pass of the retention rule: warn, then delete.
 *
 * The rule the ÁSZF states is 6 months of active availability, a warning, 30
 * days of grace, then permanent deletion. Nothing about Vercel or Supabase
 * runs on its own, so this is a function something has to call — a Vercel Cron
 * entry hitting `POST /api/retention/run` once a day. Until that exists in a
 * deployed environment the rule is written down and not enforced, which is a
 * launch blocker and is recorded as one.
 *
 * Three properties, and all three come from the same requirement — that a job
 * which can be invoked twice, concurrently, or halfway must not do damage:
 *
 * - **Bounded.** At most `limit` events per pass, so no invocation runs long.
 *   Vercel's request model has no room for "delete four hundred albums", and a
 *   job that times out halfway is exactly how objects get orphaned.
 * - **Idempotent warnings.** The warning is claimed with an `update … where
 *   retention_warned_at is null … returning`, which is one atomic statement:
 *   two overlapping runs cannot both warn the same host.
 * - **Objects before rows.** Same order and same verification as the host's
 *   own delete, sharing `purgeEventObjects`. A failure leaves the rows intact
 *   so the next pass can find the objects again.
 *
 * A legal hold takes an event out of both queries — see the `legal_hold_at`
 * column. Restricting access under a hold is a separate decision and is not
 * this function's business; all it does is not delete.
 */

/** How many events one invocation will touch, per phase. Deliberately small:
 *  this runs daily, and a backlog clears over days rather than in one request
 *  that risks timing out with objects removed and rows still present. */
const DEFAULT_LIMIT = 5

export type RetentionRunResult = {
  warned: { slug: string; delivered: boolean }[]
  deleted: string[]
  failures: { slug: string; error: string }[]
}

export async function runRetention({
  limit = DEFAULT_LIMIT,
}: { limit?: number } = {}): Promise<RetentionRunResult> {
  const result: RetentionRunResult = { warned: [], deleted: [], failures: [] }

  const db = createLegalClient()
  const admin = createAdminClient()

  const { data: toWarn, error: warnError } = await db.rpc(
    'events_awaiting_retention_warning',
    { p_limit: limit },
  )
  if (warnError) throw warnError

  for (const event of toWarn ?? []) {
    try {
      // Claim it first. The `is null` guard makes this the whole lock: whoever
      // gets a row back is the one that sends the mail, and a second run gets
      // nothing.
      const { data: claimed, error } = await db
        .from('events')
        .update({ retention_warned_at: new Date().toISOString() })
        .eq('id', event.id)
        .is('retention_warned_at', null)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!claimed) continue

      const email = await ownerEmail(admin, event.owner_id)
      if (!email) {
        // No address to warn. The deletion still happens on schedule — the
        // warning is a courtesy the retention promise does not depend on — so
        // this is recorded rather than retried.
        result.failures.push({
          slug: event.slug,
          error: 'no owner email on file',
        })
        continue
      }

      const { deleteAfter } = retentionDates(new Date(event.capture_end_at))
      const sent = await sendDurableEmail({
        kind: 'retention_warning',
        to: email,
        subject: RETENTION_EMAIL_SUBJECT,
        body: retentionEmailBody({
          eventName: event.event_name,
          deleteAfterIso: deleteAfter.toISOString(),
          timeZone: event.time_zone,
          eventUrl: eventUrl(event.slug),
        }),
        relatedId: event.id,
      })

      result.warned.push({ slug: event.slug, delivered: sent.delivered })
    } catch (e) {
      result.failures.push({ slug: event.slug, error: message(e) })
    }
  }

  const { data: toDelete, error: deleteError } = await db.rpc(
    'events_due_for_deletion',
    { p_limit: limit },
  )
  if (deleteError) throw deleteError

  for (const event of toDelete ?? []) {
    try {
      // Throws rather than half-succeeding, which leaves the rows in place so
      // the next pass can find the objects again.
      await purgeEventObjects(admin.storage, event.id)

      const { data: removed, error } = await db
        .from('events')
        .delete()
        .eq('id', event.id)
        .select('id')
      if (error) throw error
      if (!removed || removed.length === 0) {
        throw new Error('event row was not deleted')
      }

      result.deleted.push(event.slug)
    } catch (e) {
      result.failures.push({ slug: event.slug, error: message(e) })
    }
  }

  return result
}

async function ownerEmail(
  admin: ReturnType<typeof createAdminClient>,
  ownerId: string,
): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(ownerId)
  if (error) return null
  return data.user?.email ?? null
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : 'unknown error'
}
