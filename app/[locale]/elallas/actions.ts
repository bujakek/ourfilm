'use server'

import {
  submitWithdrawalRequest,
  type SubmitResult,
} from '@/lib/legal/requests'

/**
 * The one entry point for a withdrawal declaration.
 *
 * A Server Action rather than a route handler, and that is the CSRF story:
 * Next verifies the Origin against the Host for every action POST, so a form
 * posted from another site does not reach this function. Everything else —
 * validation, the rate limit, the record, the confirmation — is in
 * `lib/legal/requests.ts`, which is also where it is documented that nothing
 * here refunds anything.
 */
export async function submitWithdrawal(input: {
  fullName: string
  orderReference: string
  email: string
  note?: string
}): Promise<SubmitResult> {
  return submitWithdrawalRequest(input)
}
