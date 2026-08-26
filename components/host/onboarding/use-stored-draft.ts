'use client'

import { useSyncExternalStore } from 'react'

import { loadDraft, type EventDraft } from '@/lib/event-draft'

/**
 * The draft already in this browser, read once.
 *
 * `useSyncExternalStore` rather than an effect, for the reason it exists:
 * `localStorage` is a client-only value, so the server snapshot is null and
 * React re-renders with the real one after hydration. Reading it in an effect
 * and calling `setState` is the same result with an extra render and a lint
 * rule against it; reading it during render is a hydration mismatch.
 *
 * The snapshot is taken **once** and then held. It has to be stable — React
 * calls `getSnapshot` on every render and treats a new object as a change —
 * and holding it is also what the flow wants: the question "was there a draft
 * when this page opened" has one answer for the life of the page, and the form
 * saving over it every keystroke must not change it.
 */
let snapshot: EventDraft | null | undefined
const listeners = new Set<() => void>()

// Primed at module evaluation, which on the client happens before any effect
// in the tree can run. Waiting for the first `getSnapshot` call would be a race
// against the form's own save: whichever ran first decided whether the visitor
// was offered their draft back or silently handed an empty form. Verified —
// the form won, and the draft was gone.
if (typeof window !== 'undefined') snapshot = loadDraft(new Date())

/** Call after clearing the draft, so a restore prompt that is no longer true
 *  stops being true. */
export function invalidateStoredDraft(): void {
  snapshot = undefined
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): EventDraft | null {
  if (snapshot === undefined) snapshot = loadDraft(new Date())
  return snapshot
}

export function useStoredDraft(): EventDraft | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null)
}
