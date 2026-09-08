import type { Metadata } from 'next'

import { CompleteCreation } from './complete-creation'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Creating event — OurFilm',
  robots: { index: false, follow: false },
}

/**
 * Where the magic link lands when it was sent from the create flow.
 *
 * **Under `/auth`, not `/host`, and both halves of that matter.**
 *
 * `app/host/loading.tsx` wraps every admin segment in a Suspense boundary, and
 * a route reached through it did not hydrate on arrival — the same Next 16.3
 * failure CLAUDE.md records against `app/e/[slug]`. This screen is nothing but
 * client work, so not hydrating means it silently does nothing: no create, no
 * error, the host dropped on `/host` with their draft still pending. Verified
 * by moving it; `/auth/callback` next door has always hydrated.
 *
 * The proxy is the other half. A Server Action posts to the path of the page
 * that owns it, so an `/host/**` path meant the auth gate answered
 * `createEventFromDraft`'s own POST with a redirect and discarded the call.
 * Nothing under `/auth` is matched.
 *
 * A session is still required — `createEventFromDraft` reads it and refuses
 * without one. It is checked in the thing that writes a row rather than in
 * front of a spinner.
 */
export default function EventCompletePage() {
  return <CompleteCreation />
}
