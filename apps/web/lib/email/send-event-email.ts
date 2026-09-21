import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database } from '../supabase/database.types'
import { CONTACT_EMAIL } from '../site'
import { renderEventEmail } from './event-email'

const snapshotSchema = z.object({
  locale: z.enum(['en', 'hu']),
  eventName: z.string(),
  slug: z.string(),
  recipient: z.email(),
  photoCount: z.number().int().nonnegative(),
})

/** The exact body is stored before the first request. Even a deployment or a
 * late photo cannot change the body associated with a Resend idempotency key. */
export async function sendNextEventEmail(
  db: SupabaseClient<Database>,
): Promise<'sent' | 'empty'> {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY is not set')
  const { data: row, error } = await db.rpc('claim_event_email').maybeSingle()
  if (error) throw error
  if (!row) return 'empty'

  let payload = row.payload
  if (!payload) {
    const snapshot = snapshotSchema.parse(row.snapshot)
    const kind = z.enum(['upcoming', 'ended']).parse(row.kind)
    payload = {
      from: process.env.AUTH_EMAIL_FROM ?? 'OurFilm <noreply@ourfilm.app>',
      to: [snapshot.recipient],
      reply_to: CONTACT_EMAIL,
      ...renderEventEmail({ ...snapshot, kind }),
    }
    const { data: saved, error: saveError } = await db
      .from('event_emails')
      .update({ payload })
      .eq('id', row.id)
      .select('id')
      .maybeSingle()
    if (saveError) throw saveError
    // Event deletion cascades the outbox; do not send after that deletion.
    if (!saved) return 'empty'
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `event-email-${row.id}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) {
    const failure = new Error('Event email provider refused request')
    failure.name = `EmailDeliveryHttp${response.status}Error`
    throw failure
  }
  const { error: sentError } = await db
    .from('event_emails')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', row.id)
  if (sentError) throw sentError
  return 'sent'
}
