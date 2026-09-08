import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Locale } from '../i18n'
import { SITE_URL } from '../site'
import type { Database } from '../supabase/database.types'
import { renderEmailLayout } from '../email/layout'
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
  byteSize?: number | null
  missingCount?: number
}): { subject: string; html: string; text: string } {
  const { eventName, url, photoCount } = input
  const hu = input.locale === 'hu'
  const subject = hu
    ? `Elkészült az album: ${eventName}`
    : `Your album is ready: ${eventName}`
  const size = formatBytes(input.byteSize ?? null, input.locale)
  const figures = [
    { label: hu ? 'Kép' : 'Photos', value: String(photoCount) },
    ...(size ? [{ label: hu ? 'Méret' : 'Size', value: size }] : []),
    {
      label: hu ? 'Elérhető' : 'Available',
      value: hu ? '48 óráig' : '48 hours',
    },
  ]
  const missing =
    input.missingCount && input.missingCount > 0
      ? hu
        ? `${input.missingCount} képet nem sikerült beletenni; a ZIP-ben egy HIANYZO-KEPEK.txt sorolja fel őket.`
        : `${input.missingCount} photo(s) could not be included; HIANYZO-KEPEK.txt inside the ZIP lists them.`
      : null

  const { html, text } = renderEmailLayout({
    locale: input.locale,
    preheader: hu
      ? `${photoCount} kép egy ZIP-fájlban, 48 óráig letölthető.`
      : `${photoCount} photos in one ZIP, available for 48 hours.`,
    eyebrow: hu ? 'Album' : 'Album',
    heading: eventName,
    intro: [
      hu
        ? 'Elkészült az album. Minden kép egyetlen ZIP-fájlban, a felvétel idejével a fájlnevekben és a képekben.'
        : 'The album is ready. Every photo in one ZIP, with the capture time in the filenames and in the files themselves.',
    ],
    figures,
    button: { label: hu ? 'Album letöltése' : 'Download the album', url },
    underButton: hu
      ? 'A gomb az eseményed oldalára visz; a letöltés onnan indul.'
      : 'The button opens your event page; the download starts there.',
    note:
      missing ??
      (hu
        ? 'A letöltés 48 óráig érhető el. Utána ugyanezen az oldalon újra elkészítjük, ha kéred.'
        : 'The download is available for 48 hours. After that we prepare it again on request, on the same page.'),
    footer: hu
      ? 'Ezt a levelet azért kaptad, mert a házigazdaként albumot kértél az eseményedhez.'
      : 'You received this because, as the host, you asked for the album of your event.',
  })
  return { subject, html, text }
}

function formatBytes(bytes: number | null, locale: Locale): string | null {
  if (!bytes) return null
  const gb = bytes / 1024 ** 3
  if (gb >= 1)
    return `${gb.toFixed(1).replace('.', locale === 'hu' ? ',' : '.')} GB`
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`
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
      byteSize: row.byte_size,
      missingCount: row.missing_count,
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
