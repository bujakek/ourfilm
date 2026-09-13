import 'server-only'

import { after } from 'next/server'

import type { ReservedShot } from './capture'
import { reportServerEvent } from './telemetry-server'

type Deps = {
  /** Keep the invocation alive for the report. `after` in production. */
  defer: (task: () => Promise<unknown>) => void
  report: typeof reportServerEvent
}

const live: Deps = { defer: (task) => after(task), report: reportServerEvent }

/**
 * Report a reservation the upload grace let in, without touching the answer.
 *
 * The 24-hour grace is a reasoned number rather than a measured one; this is
 * the measurement. It is sent through `after()` and never awaited, because
 * `posthog-node` retries a failed send for most of a minute and the browser
 * gives up on a reserve after twenty seconds. Nothing here can throw into the
 * action.
 */
export function reportGraceReservation(
  {
    eventId,
    captureId,
    surface,
    shot,
  }: {
    eventId: string
    captureId: string
    surface: 'guest' | 'host'
    shot: ReservedShot
  },
  deps: Deps = live,
): void {
  const grace = shot.grace
  if (!grace) return

  try {
    deps.defer(() =>
      deps.report('shot_reserved_in_grace', {
        event_id: eventId,
        capture_id: captureId,
        surface,
        late_seconds: grace.lateSeconds,
        claimed_lead_seconds: grace.claimedLeadSeconds,
      }),
    )
  } catch (error) {
    console.warn('Grace telemetry could not be deferred', error)
  }
}
