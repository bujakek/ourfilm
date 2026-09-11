'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

/** How long to keep re-checking after Stripe sends the host back. */
export const SETTLE_POLL_MS = 2000
export const SETTLE_POLL_TRIES = 6

/**
 * Re-render the page every couple of seconds while a payment settles, then
 * stop.
 *
 * Stripe redirects the host back the instant checkout finishes, which is often
 * before the webhook that records it has landed. Without this the first thing a
 * host sees after paying is their album still saying it is capped.
 *
 * Bounded on purpose. An unbounded poll would keep a tab hitting the server
 * forever when a webhook is misconfigured — which is exactly the situation
 * where nobody is watching — and the host is better served by the page going
 * quiet and them reloading than by a spinner that never resolves.
 *
 * Shared by the billing card and the checkout success screen: both are looking
 * at the same gap between Stripe's redirect and our own webhook, and a second
 * copy of the budget would drift from this one the first time either changed.
 */
export function useSettlePolling(active: boolean) {
  const router = useRouter()
  const [tries, setTries] = useState(0)

  useEffect(() => {
    if (!active || tries >= SETTLE_POLL_TRIES) return
    const timer = setTimeout(() => {
      setTries((n) => n + 1)
      router.refresh()
    }, SETTLE_POLL_MS)
    return () => clearTimeout(timer)
  }, [active, tries, router])
}
