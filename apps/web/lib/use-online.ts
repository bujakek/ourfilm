'use client'

import { useSyncExternalStore } from 'react'

/**
 * Whether the browser believes it has a connection.
 *
 * `useSyncExternalStore` rather than an effect, for the same reason
 * `use-browser-time-zone.ts` uses it: this is an external value that changes
 * on its own, and an effect would have to set state to track it — a render
 * behind, and a cascading render every time the wifi drops.
 *
 * **The server snapshot is `true`, deliberately.** The server cannot know, and
 * a pessimistic guess would flash "Nincs kapcsolat" in amber on every single
 * page load before hydration corrects it. A guest who really is offline sees
 * the marker one frame later; a guest who is not never sees it at all.
 *
 * What this does *not* catch: `navigator.onLine` is false only when the OS
 * reports no usable interface — airplane mode, no signal, wifi off. A venue
 * network that hands out a lease and routes nothing, or a captive portal, both
 * read as online here. That is the honest limit of the browser API, and it is
 * why this marker is a courtesy on top of `lib/upload-queue.ts` rather than
 * the thing that keeps a photo safe: the queue retries on its own timer
 * whatever this says, and the shot is in IndexedDB either way.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener('online', onStoreChange)
  window.addEventListener('offline', onStoreChange)
  return () => {
    window.removeEventListener('online', onStoreChange)
    window.removeEventListener('offline', onStoreChange)
  }
}

function getSnapshot(): boolean {
  return navigator.onLine
}

function getServerSnapshot(): boolean {
  return true
}
