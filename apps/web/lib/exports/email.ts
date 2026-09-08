import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Locale } from '../i18n'
import { SITE_URL } from '../site'
import type { Database } from '../supabase/database.types'
import { reportServerEvent, reportServerIssue } from '../telemetry-server'
import type { AlbumExportRow } from './jobs'

/**
 * The export-ready mail: the most important email the product sends.
 *
 * Vercel sends it, not the worker — the host's address lives in `auth.users`,
 * and a worker that holds customer emails and a mail credential is a much
 * larger thing than a pipe that zips public images. It links to the host's
 * page, never to a signed download URL: an email like this is forwarded,
 * archived and searched years later, and a signed URL is a bearer token for
 * the entire wedding sitting in an inbox. The page is behind auth and mints a
 * fresh URL on click; and because the endpoint re-derives from `source_hash`,
 * a link opened on day four prepares the album again rather than 404ing.
 *
 * Delivery is guaranteed rather than attempted: `notified_at` is set only on
 * a successful send, and the sweep retries every ready row where it is still
 * null, up to `MAX_NOTIFY_ATTEMPTS`. Resend's idempotency key is the export
 * id plus the attempt, so a retry of a send that actually succeeded cannot
 * become two mails.
 */

export const MAX_NOTIFY_ATTEMPTS = 5

type Db = SupabaseClient<Database>

export function renderExportReadyEmail(input: {
  locale: Locale
  eventName: string
  url: string
  photoCount: number
}): { subject: string; html: string; text: string } {
  const { eventName, url, photoCount } = input
  const hu = input.locale === 'hu'
  const subject = hu
    ? `Elkészült az album: ${eventName}`
    : `Your album is ready: ${eventName}`
  const lines = hu
    ? [
        `Elkészült az album a(z) ${eventName} eseményhez — ${photoCount} kép, egy ZIP-fájlban.`,
        `Letöltés innen: ${url}`,
        'A letöltés 48 óráig érhető el. Utána újra elkészítjük, ha kéred — ugyanezen az oldalon.',
      ]
    : [
        `The album for ${eventName} is ready — ${photoCount} photos in one ZIP.`,
        `Download it here: ${url}`,
        'The download is available for 48 hours. After that we prepare it again on request, on the same page.',
      ]
  const text = lines.join('\n\n') + '\n\n— OurFilm\n'
  const html =
    `<!doctype html><html lang="${input.locale}"><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111;line-height:1.5">` +
    `<p>${escapeHtml(lines[0])}</p>` +
    `<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;border-radius:8px;text-decoration:none">${hu ? 'Album letöltése' : 'Download the album'}</a></p>` +
    `<p style="color:#555;font-size:14px">${escapeHtml(lines[2])}</p>` +
    `<p style="color:#555;font-size:14px">— OurFilm</p></body></html>`
  return { subject, html, text }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Send the mail for one ready export, and record the outcome on the row.
 *
 * Idempotent per row: a row already notified is skipped, and a row that has
 * spent its attempts is left for the alert. Never throws — the caller is a
 * response that has already been decided, or the sweep, and neither should
 * fail because Resend did.
 */
export async function sendExportReadyEmail(
  db: Db,
  row: AlbumExportRow,
): Promise<'sent' | 'skipped' | 'failed'> {
  if (row.status !== 'ready' || row.notified_at) return 'skipped'
  if (row.notify_attempts >= MAX_NOTIFY_ATTEMPTS) return 'skipped'

  const resendKey = process.env.RESEND_API_KEY
  try {
    const { data: event, error: eventError } = await db
      .from('events')
      .select('id, slug, event_name, locale, owner_id')
      .eq('id', row.event_id)
      .maybeSingle()
    if (eventError) throw eventError
    if (!event) return 'skipped' // the event went; the row goes with it

    const { data: owner, error: ownerError } = await db.auth.admin.getUserById(
      event.owner_id,
    )
    if (ownerError) throw ownerError
    const to = owner.user?.email
    if (!to) throw new Error('Host has no email address')
    if (!resendKey) throw new Error('RESEND_API_KEY is not set')

    const locale: Locale = event.locale === 'en' ? 'en' : 'hu'
    const url = `${SITE_URL}/host/events/${event.slug}?lang=${locale}`
    const email = renderExportReadyEmail({
      locale,
      eventName: event.event_name,
      url,
      photoCount: row.photo_count,
    })

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `export-ready-${row.id}-${row.notify_attempts}`,
      },
      body: JSON.stringify({
        from: process.env.AUTH_EMAIL_FROM ?? 'OurFilm <noreply@ourfilm.app>',
        to: [to],
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    })
    if (!response.ok) {
      const failure = new Error('Export email provider refused request')
      failure.name = `EmailDeliveryHttp${response.status}Error`
      throw failure
    }

    await db
      .from('album_exports')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', row.id)
    await reportServerEvent('album_export_email_sent', {
      event_id: row.event_id,
      locale,
    })
    return 'sent'
  } catch (e) {
    const attempts = row.notify_attempts + 1
    await db
      .from('album_exports')
      .update({ notify_attempts: attempts })
      .eq('id', row.id)
    await reportServerIssue(e, {
      operation: 'album_export_email',
      eventId: row.event_id,
      route: '/api/exports/[id]/complete',
      routeType: 'route',
      method: 'POST',
    })
    await reportServerEvent('album_export_email_failed', {
      event_id: row.event_id,
      attempts,
    })
    return 'failed'
  }
}
