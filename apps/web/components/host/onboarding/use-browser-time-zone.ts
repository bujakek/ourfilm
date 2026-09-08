'use client'

import { useSyncExternalStore } from 'react'

import { EVENT_TIME_ZONE, browserTimeZone } from '@/lib/format'

/** The zone never changes under a running page, so there is nothing to
 *  subscribe to — but `useSyncExternalStore` still wants a subscriber, and one
 *  shared no-op keeps React from re-subscribing on every render. */
const subscribe = () => () => {}

/**
 * The IANA zone this browser is in, `EVENT_TIME_ZONE` on the server.
 *
 * A browser-only value read during render is exactly what
 * `useSyncExternalStore` exists for: the server snapshot renders, React
 * notices the client snapshot differs, and it re-renders after hydration. The
 * obvious alternative — read it in an effect and `setState` — is the same
 * result with an extra render, an extra state variable and a lint rule
 * against it.
 */
export function useBrowserTimeZone(): string {
  return useSyncExternalStore(subscribe, browserTimeZone, () => EVENT_TIME_ZONE)
}
