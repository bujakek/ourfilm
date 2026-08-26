import 'server-only'

import { createLegalClient } from './db'

/**
 * Durable delivery for the confirmations the legal pages promise.
 *
 * The ÁSZF says an online withdrawal declaration is confirmed "tartós
 * adathordozón haladéktalanul", and the report page promises the same. So the
 * message is **recorded before it is sent**: the row in `outbound_emails` is
 * the durable copy, and the delivery attempt is what may fail. A provider
 * outage then leaves a row an operator can retry, rather than a promise the
 * system quietly broke and has no memory of.
 *
 * There is no worker and nothing polls the table — Vercel gives us no
 * background process, and this product deliberately has none (see the MVP
 * scope). The send happens inline in the same request; the row is the audit
 * trail, not a queue.
 *
 * **Resend is reached over its HTTP API here, not over SMTP.** The SMTP
 * credentials configured in the Supabase dashboard belong to Supabase Auth and
 * send the magic links; they are not reachable from application code. That is
 * why this needs its own `RESEND_API_KEY`, and why the absence of one is a
 * launch blocker rather than a fallback: an unconfigured environment records
 * the message and reports that it could not be delivered.
 */

export type MailResult = {
  /** Always true once the row exists — the durable copy is the guarantee. */
  recorded: boolean
  /** Whether the provider actually accepted it. */
  delivered: boolean
  id: string | null
}

export function mailIsConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.LEGAL_EMAIL_FROM)
}

export async function sendDurableEmail({
  kind,
  to,
  subject,
  body,
  relatedId,
}: {
  kind: string
  to: string
  subject: string
  body: string
  relatedId?: string | null
}): Promise<MailResult> {
  const db = createLegalClient()

  const { data: row, error } = await db
    .from('outbound_emails')
    .insert({
      kind,
      to_email: to,
      subject,
      body,
      related_id: relatedId ?? null,
    })
    .select('id')
    .maybeSingle()

  if (error || !row) {
    // The caller must still succeed: a person who has just declared their
    // withdrawal has exercised a right, and losing that because a mail table
    // was unreachable would be the worse failure by a wide margin.
    console.error('Could not record an outbound legal email', error)
    return { recorded: false, delivered: false, id: null }
  }

  if (!mailIsConfigured()) {
    await db
      .from('outbound_emails')
      .update({
        attempts: 1,
        last_error:
          'RESEND_API_KEY / LEGAL_EMAIL_FROM not configured in this environment.',
      })
      .eq('id', row.id)
    return { recorded: true, delivered: false, id: row.id }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.LEGAL_EMAIL_FROM,
        to: [to],
        subject,
        text: body,
      }),
    })

    if (!response.ok) {
      // The body is the provider's error, not ours, and it can carry the
      // recipient address back — truncated so a long HTML error page does not
      // become the bulk of the table.
      const detail = (await response.text()).slice(0, 500)
      await db
        .from('outbound_emails')
        .update({ attempts: 1, last_error: `${response.status}: ${detail}` })
        .eq('id', row.id)
      return { recorded: true, delivered: false, id: row.id }
    }

    const payload = (await response.json()) as { id?: string }
    await db
      .from('outbound_emails')
      .update({
        attempts: 1,
        sent_at: new Date().toISOString(),
        provider_message_id: payload.id ?? null,
      })
      .eq('id', row.id)

    return { recorded: true, delivered: true, id: row.id }
  } catch (e) {
    await db
      .from('outbound_emails')
      .update({
        attempts: 1,
        last_error: e instanceof Error ? e.message.slice(0, 500) : 'unknown',
      })
      .eq('id', row.id)
    return { recorded: true, delivered: false, id: row.id }
  }
}
