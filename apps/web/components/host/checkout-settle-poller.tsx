'use client'

import { useSettlePolling } from './use-settle-polling'

/**
 * Nothing on screen — it only re-reads the page while the webhook catches up.
 *
 * The success screen around it is a Server Component, because every word on it
 * is decided by state only the server can read. This is the one part that has
 * to run in the browser, so it is the only part that does.
 */
export function CheckoutSettlePoller() {
  useSettlePolling(true)
  return null
}
