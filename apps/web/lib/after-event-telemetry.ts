import 'server-only'

import { after } from 'next/server'

import type { ReserveResult } from './capture'
import { createAdminClient } from './supabase/admin'
import { reportServerEvent } from './telemetry-server'

type Deps = {
  /** Keep the invocation alive for the report. `after` in production. */
  defer: (task: () => Promise<unknown>) => void
  report: typeof reportServerEvent
  /** Whether this participant first joined after the close. Read inside the
   *  deferred task, so the guest's reservation never waits on it. */
  joinedAfterClose: (
    eventId: string,
    tokenHash: string,
  ) => Promise<boolean | null>
}

async function joinedAfterClose(
  eventId: string,
  tokenHash: string,
): Promise<boolean | null> {
  const db = createAdminClient()
  const [participant, event] = await Promise.all([
    db
      .from('participants')
      .select('joined_at')
      .eq('event_id', eventId)
      .eq('session_token_hash', tokenHash)
      .maybeSingle(),
    db.from('events').select('capture_end_at').eq('id', eventId).maybeSingle(),
  ])
  if (!participant.data || !event.data) return null
  return (
    Date.parse(participant.data.joined_at) >
    Date.parse(event.data.capture_end_at)
  )
}

const live: Deps = {
  defer: (task) => after(task),
  report: reportServerEvent,
  joinedAfterClose,
}

/**
 * Report one after-event gallery reservation, without touching the answer.
 *
 * Admitted and refused both count — a refusal by name is how a guest who
 * missed the deadline or ran out of frames shows up at all. A replay of an
 * existing reservation does not: it spends nothing and was counted the first
 * time. Sent through `after()` and never awaited, for the reason in
 * `grace-telemetry.ts`; nothing here can throw into the action.
 */
export function reportAfterEventReservation(
  {
    eventId,
    captureId,
    tokenHash,
    result,
  }: {
    eventId: string
    captureId: string
    tokenHash: string
    result: ReserveResult
  },
  deps: Deps = live,
): void {
  if (result.ok && !result.shot.afterEvent) return
  try {
    deps.defer(async () => {
      if (!result.ok) {
        return deps.report('after_event_reserve', {
          event_id: eventId,
          capture_id: captureId,
          outcome: result.refusal,
          late_seconds: null,
          shots_remaining: null,
          joined_after_close: null,
        })
      }
      return deps.report('after_event_reserve', {
        event_id: eventId,
        capture_id: captureId,
        outcome: 'admitted',
        late_seconds: result.shot.afterEvent!.lateSeconds,
        shots_remaining: result.shot.shotsRemaining,
        joined_after_close: await deps
          .joinedAfterClose(eventId, tokenHash)
          .catch(() => null),
      })
    })
  } catch (error) {
    console.warn('After-event telemetry could not be deferred', error)
  }
}
