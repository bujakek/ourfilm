import type { Metadata } from 'next'

import { eventNameSuggestions } from '@/lib/onboarding'
import { NewEventForm } from './new-event-form'

// Both the suggested deadline and the earliest selectable day are computed from
// the clock, so this page cannot be prerendered — a build-time default would go
// stale the day after a deploy.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Új esemény — OurFilm',
  robots: { index: false, follow: false },
}

/**
 * Where the suggested end lands: six hours out, floored to the half hour.
 *
 * The camera now opens the moment the event is created, so this is no longer a
 * date days ahead — it is tonight. Six hours is a party: pick it at six in the
 * evening and it ends at midnight, pick it at ten and it runs to four. Floored
 * to :00 or :30 because 23:42 reads as a value someone typed, and this one is a
 * guess the host is meant to move.
 */
const SUGGESTED_HOURS = 6
const HALF_HOUR_MS = 30 * 60 * 1000

/**
 * **This component must stay synchronous.** `app/admin/loading.tsx` puts a
 * Suspense boundary around every admin segment, and an `async` page here makes
 * this segment suspend into it — at which point the boundary never completes on
 * the client and the whole flow is served as unhydrated markup: the suggestions
 * do nothing, the CTA never enables, and nothing says why. It is the same Next
 * 16.3 failure CLAUDE.md records against `app/e/[slug]`, reproduced here by
 * A/B (remove the loading file and it hydrates, restore it and it does not).
 *
 * That is why the host's account is not read here. `proxy.ts` already gates
 * `/admin/:path*`, so there is nothing to check — and the only thing an
 * `await supabase.auth.getUser()` would add is a first name for two of the five
 * ÖTLETEK. Magic-link signups carry no name, so every account today falls back
 * anyway; `eventNameSuggestions` takes one the day a provider supplies it, and
 * whoever wires that up has to get it here without suspending the segment.
 */
export default function NewEventPage() {
  const now = new Date()
  const end = new Date(
    Math.floor(
      (now.getTime() + SUGGESTED_HOURS * 60 * 60 * 1000) / HALF_HOUR_MS,
    ) * HALF_HOUR_MS,
  )

  return (
    <NewEventForm
      nowIso={now.toISOString()}
      defaultEndIso={end.toISOString()}
      suggestions={eventNameSuggestions(null)}
    />
  )
}
