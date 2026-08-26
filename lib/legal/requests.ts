import 'server-only'

import { LEGAL_VERSION } from './config'
import {
  REPORT_EMAIL_SUBJECT,
  reportEmailBody,
  WITHDRAWAL_EMAIL_SUBJECT,
  withdrawalEmailBody,
} from './copy/forms'
import { createLegalClient } from './db'
import { sendDurableEmail } from './email'
import { newPublicReference } from './reference'
import { readRequestMeta } from './request-meta'
import { reportSchema, withdrawalSchema } from './request-schemas'

/**
 * The two legal intakes: a withdrawal declaration and an illegal-content
 * report.
 *
 * Both follow the same three steps, in this order and no other: validate,
 * record, then confirm. Recording before confirming is what makes the
 * confirmation honest — the email says "megkaptuk", and it must not be able to
 * say that about something that was never written down.
 *
 * **Neither ever acts on the request.** No refund is issued, no event is
 * deleted, no photo is hidden. The ÁSZF says so in as many words ("A rendszer
 * nem adhat automatikusan visszatérítést emberi ellenőrzés nélkül"), and a
 * form on the open internet that could delete a wedding album or move money
 * would be an abuse channel rather than a legal remedy. What each one produces
 * is a row with a status an operator advances by hand.
 */

export type SubmitResult =
  { ok: true; reference: string } | { ok: false; error: string }

/**
 * How many submissions one client may make in an hour.
 *
 * Counted against the stored `ip_hash` rather than an in-memory counter: every
 * request is a fresh serverless invocation, so an in-process limiter would
 * reset constantly and protect nothing. The window is deliberately generous —
 * a person who genuinely needs to report three photos in one evening must not
 * be turned away — and its job is to stop a script, not a determined human.
 */
const RATE_WINDOW_MS = 60 * 60 * 1000
const RATE_LIMIT = 5

const RATE_LIMITED =
  'Túl sok kérelem érkezett rövid időn belül. Próbáld újra később, vagy írj nekünk e-mailben.'
const GENERIC_FAILURE =
  'Nem sikerült rögzíteni a kérelmet. Próbáld újra, vagy írj nekünk e-mailben.'

async function withinRateLimit(
  table: 'withdrawal_requests' | 'content_reports',
  ipHash: string | null,
): Promise<boolean> {
  // No address to count against — a proxy stripped it, or this is a local
  // request. Letting it through is the right way to be wrong: the alternative
  // refuses a legal declaration because a header was missing.
  if (!ipHash) return true

  const db = createLegalClient()
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString()

  const { count, error } = await db
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('submitted_at', since)

  if (error) {
    console.error('Could not check the legal form rate limit', error)
    return true
  }
  return (count ?? 0) < RATE_LIMIT
}

export async function submitWithdrawalRequest(
  input: unknown,
): Promise<SubmitResult> {
  const parsed = withdrawalSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Nézd át a megadott adatokat: minden kötelező mezőt tölts ki.',
    }
  }

  const meta = await readRequestMeta()
  if (!(await withinRateLimit('withdrawal_requests', meta.ipHash))) {
    return { ok: false, error: RATE_LIMITED }
  }

  const db = createLegalClient()
  const reference = newPublicReference('ELA')

  const { data, error } = await db
    .from('withdrawal_requests')
    .insert({
      public_reference: reference,
      full_name: parsed.data.fullName,
      order_reference: parsed.data.orderReference,
      email: parsed.data.email,
      note: parsed.data.note || null,
      legal_version: LEGAL_VERSION,
      ip_hash: meta.ipHash,
      user_agent: meta.userAgent,
    })
    .select('id, submitted_at')
    .maybeSingle()

  if (error || !data) {
    console.error('Could not record a withdrawal request', error)
    return { ok: false, error: GENERIC_FAILURE }
  }

  await sendDurableEmail({
    kind: 'withdrawal_confirmation',
    to: parsed.data.email,
    subject: WITHDRAWAL_EMAIL_SUBJECT,
    body: withdrawalEmailBody({
      submittedAtIso: data.submitted_at,
      orderReference: parsed.data.orderReference,
    }),
    relatedId: data.id,
  })

  return { ok: true, reference }
}

export async function submitContentReport(
  input: unknown,
): Promise<SubmitResult> {
  const parsed = reportSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error:
        'Nézd át a megadott adatokat: minden kötelező mezőt tölts ki, és jelöld be a nyilatkozatot.',
    }
  }

  const meta = await readRequestMeta()
  if (!(await withinRateLimit('content_reports', meta.ipHash))) {
    return { ok: false, error: RATE_LIMITED }
  }

  const db = createLegalClient()
  const reference = newPublicReference('BEJ')

  const { data, error } = await db
    .from('content_reports')
    .insert({
      public_reference: reference,
      reporter_name: parsed.data.reporterName,
      reporter_email: parsed.data.reporterEmail,
      event_reference: parsed.data.eventReference,
      content_reference: parsed.data.contentReference,
      reason: parsed.data.reason,
      legal_basis: parsed.data.legalBasis,
      good_faith: true,
      legal_version: LEGAL_VERSION,
      ip_hash: meta.ipHash,
      user_agent: meta.userAgent,
    })
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error('Could not record a content report', error)
    return { ok: false, error: GENERIC_FAILURE }
  }

  await sendDurableEmail({
    kind: 'content_report_confirmation',
    to: parsed.data.reporterEmail,
    subject: REPORT_EMAIL_SUBJECT,
    body: reportEmailBody({ reference }),
    relatedId: data.id,
  })

  return { ok: true, reference }
}
