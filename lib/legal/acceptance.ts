import 'server-only'

import { LEGAL_VERSION } from './config'
import { createLegalClient } from './db'
import type { LegalDocumentKind } from './database.types'
import { readRequestMeta } from './request-meta'

/**
 * Recording — and reading back — who agreed to what.
 *
 * Two rules the shape of this module comes from:
 *
 * **Notices are read, contracts are accepted.** Only the ÁSZF, the express
 * early-performance request and the guest terms produce a row. There is no
 * `privacy_notice` acceptance anywhere, because recording one would suggest
 * the processing rests on consent when it rests on contract and legitimate
 * interest — a mislabelled record is worse evidence than no record.
 *
 * **A guest is never asked for identity in order to be evidenced.** The row
 * carries the participant's id and their chosen display name, both of which
 * already exist because they took a photo. No email, no account, nothing
 * collected solely so there would be something to keep.
 *
 * Every write goes through the service-role client: the table has RLS on and
 * no policies at all, which makes it append-only for every ordinary user of
 * the application by construction rather than by a trigger someone could drop.
 */

export type HostAcceptanceInput = {
  userId: string
  eventId: string | null
  eventSlug: string | null
  /** Which declarations the host actually ticked. */
  documents: LegalDocumentKind[]
}

export async function recordHostAcceptance(
  input: HostAcceptanceInput,
): Promise<void> {
  if (input.documents.length === 0) return

  const meta = await readRequestMeta()
  const db = createLegalClient()

  const { error } = await db.from('legal_acceptances').insert(
    input.documents.map((document) => ({
      document,
      legal_version: LEGAL_VERSION,
      user_id: input.userId,
      event_id: input.eventId,
      participant_id: null,
      event_slug: input.eventSlug,
      subject_label: null,
      ip_hash: meta.ipHash,
      user_agent: meta.userAgent,
    })),
  )

  // Logged, never thrown. An event that exists with its acceptance evidence
  // missing is a gap to investigate; an event that failed to be created
  // because the evidence insert failed is a host who paid and got nothing.
  if (error) console.error('Could not record host legal acceptance', error)
}

/**
 * Returns whether the row was written, unlike the host path above.
 *
 * The asymmetry is deliberate. A host acceptance that fails to record leaves
 * an event that exists and works, so it is logged and the creation proceeds —
 * losing the event would be far worse. A guest acceptance is a *gate*: the
 * camera is not rendered until one exists, so a silent failure is an infinite
 * loop of the same screen. The caller has to be able to say so.
 */
export async function recordGuestAcceptance({
  participantId,
  eventId,
  eventSlug,
  displayName,
}: {
  participantId: string
  eventId: string
  eventSlug: string
  displayName: string | null
}): Promise<boolean> {
  const meta = await readRequestMeta()
  const db = createLegalClient()

  const { error } = await db.from('legal_acceptances').insert({
    document: 'guest_terms',
    legal_version: LEGAL_VERSION,
    user_id: null,
    event_id: eventId,
    participant_id: participantId,
    event_slug: eventSlug,
    subject_label: displayName,
    ip_hash: meta.ipHash,
    user_agent: meta.userAgent,
  })

  if (error) {
    console.error('Could not record guest legal acceptance', error)
    return false
  }
  return true
}

/**
 * Whether this participant has already acknowledged the current version.
 *
 * Per participant and per version, so a guest is asked once per event rather
 * than once per shot — and asked again if the document is revised, which is
 * the only reason the version is part of the key.
 *
 * A failure here returns `false`, which shows the notice again. Showing it
 * twice is a small annoyance; skipping it is the failure that matters.
 */
export async function hasGuestAcceptance(
  participantId: string,
): Promise<boolean> {
  try {
    const db = createLegalClient()
    const { data, error } = await db
      .from('legal_acceptances')
      .select('id')
      .eq('participant_id', participantId)
      .eq('document', 'guest_terms')
      .eq('legal_version', LEGAL_VERSION)
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return Boolean(data)
  } catch (e) {
    console.error('Could not read guest legal acceptance', e)
    return false
  }
}
