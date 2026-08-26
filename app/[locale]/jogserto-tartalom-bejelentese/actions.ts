'use server'

import { submitContentReport, type SubmitResult } from '@/lib/legal/requests'

/**
 * The one entry point for an illegal-content report.
 *
 * Returns a reference and nothing else. In particular it never returns
 * anything about the reported event — whether it exists, who owns it, how many
 * photos it holds — because this form is open to the internet and an
 * "esemény nem található" would turn it into an oracle for testing slugs.
 */
export async function submitReport(input: {
  reporterName: string
  reporterEmail: string
  eventReference: string
  contentReference: string
  reason: string
  legalBasis: string
  goodFaith: boolean
}): Promise<SubmitResult> {
  return submitContentReport(input)
}
