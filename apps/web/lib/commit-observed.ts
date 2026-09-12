import 'server-only'

import { after } from 'next/server'

import { commitShot, type CommitShotResult } from './capture'
import { photoRef } from './photo-ref'
import { createAdminClient } from './supabase/admin'
import {
  reportServerEvent,
  reportServerIssue,
  safeServerErrorName,
} from './telemetry-server'

/**
 * `commit_shot`, with a record of every way it can end.
 *
 * The commit is the last step of a capture and the most expensive one to lose:
 * the three renders are already in Storage, and a row that never goes `ready`
 * is a photo nobody will be shown. It was also the least observable. A request
 * with no participant cookie answered `committed: false` and reported nothing;
 * one that threw reported a `server_error` with no event or photo on it; and a
 * success left nothing on the server's side at all. So when a row was found
 * `pending` with all three files present, there was no way to tell a commit
 * that never arrived from one that arrived and was refused.
 *
 * Shared by the guest's and the host's action, which differ only in how the
 * caller is identified.
 *
 * ## Telemetry never decides the outcome
 *
 * Nothing reported here is awaited on the way to the answer. Each report
 * starts at once and is handed to `after()`, which keeps a Vercel invocation
 * alive until it settles — including when the action throws. That matters
 * more than it looks: `posthog-node` retries a failed send three times, three
 * seconds apart, with a ten-second timeout each, so an awaited report during a
 * PostHog incident can hold a response for most of a minute — past the
 * browser's own twenty-second commit timeout, which then reads a real server
 * error as a lost connection. The existing `server_error` for this operation
 * used to be awaited exactly like that.
 */

export type CommitRefusal =
  | 'no_session'
  | 'not_owner'
  | 'no_participant'
  | 'not_matched'
  | 'empty_response'

export type CommitShotAnswer = {
  committed: boolean
  shotsRemaining: number
  /** Why not, as a code. Harmless to hand the browser, which reports it. */
  refusal?: CommitRefusal
}

export type CommitShotInput = {
  photoId: string
  width: number
  height: number
  byteSize: number
  takenAt: string | null
  /** The browser's capture id and attempt id. Claims, used only to join
   *  reports — never to decide anything. */
  captureId?: string | null
  attemptId?: string | null
}

export type CommitCaller =
  | { ok: true; tokenHash: string; eventId: string | null }
  | { ok: false; refusal: 'no_session' | 'not_owner' | 'no_participant' }

/** The row, read back for the report. Null when there is no such photo. */
export type CommittedRow = {
  eventId: string
  captureId: string | null
  status: string
  owned: boolean
} | null

export type CommitObservationDeps = {
  identify: () => Promise<CommitCaller>
  commit: (
    args: Omit<CommitShotInput, 'captureId' | 'attemptId'> & {
      tokenHash: string
    },
  ) => Promise<CommitShotResult>
  inspect: (photoId: string, tokenHash: string | null) => Promise<CommittedRow>
  report: typeof reportServerEvent
  reportIssue: typeof reportServerIssue
  /** Keep the invocation alive for a report. `after` in production. */
  defer: (task: () => Promise<unknown>) => void
  now: () => number
}

type Surface = 'guest' | 'host'

export async function observeCommitShot({
  surface,
  route,
  input,
  deps,
}: {
  surface: Surface
  route: string
  input: CommitShotInput
  deps: CommitObservationDeps
}): Promise<CommitShotAnswer> {
  const started = deps.now()
  const ref = photoRef(input.photoId)
  const claimed = {
    surface,
    claimed_capture_id: input.captureId ?? null,
    attempt_id: input.attemptId ?? null,
  }

  background(deps, async () =>
    deps.report('commit_shot_received', {
      surface,
      photo_ref: await ref,
      claimed_capture_id: claimed.claimed_capture_id,
      attempt_id: claimed.attempt_id,
    }),
  )

  function finish(
    ending: {
      outcome: 'committed' | 'refused' | 'error'
      reason: string | null
      error?: unknown
    },
    tokenHash: string | null,
    knownEventId: string | null,
  ) {
    const durationMs = deps.now() - started
    background(deps, async () => {
      // Read back after the fact, so a refusal or a throw still says what the
      // row looks like now — including whether an update landed after all.
      let row: CommittedRow | undefined
      try {
        row = await deps.inspect(input.photoId, tokenHash)
      } catch {
        row = undefined
      }
      const eventId = row?.eventId ?? knownEventId

      if (ending.outcome === 'error') {
        await deps.reportIssue(ending.error, {
          operation:
            ending.reason === 'identify'
              ? 'commit_shot_identify'
              : 'commit_shot',
          eventId,
          route,
          routeType: 'action',
        })
      }

      await deps.report('commit_shot_finished', {
        ...claimed,
        event_id: eventId,
        capture_id: row?.captureId ?? null,
        capture_id_matches:
          row?.captureId && claimed.claimed_capture_id
            ? row.captureId === claimed.claimed_capture_id
            : null,
        photo_ref: await ref,
        outcome: ending.outcome,
        reason: ending.reason,
        error_name:
          ending.outcome === 'error' ? safeServerErrorName(ending.error) : null,
        duration_ms: durationMs,
        row:
          row === undefined
            ? 'unknown'
            : row === null
              ? 'missing'
              : row.owned
                ? 'owned'
                : 'foreign',
        status_after: row?.status ?? null,
      })
    })
  }

  let caller: CommitCaller
  try {
    caller = await deps.identify()
  } catch (error) {
    finish({ outcome: 'error', reason: 'identify', error }, null, null)
    throw error
  }

  if (!caller.ok) {
    finish({ outcome: 'refused', reason: caller.refusal }, null, null)
    return { committed: false, shotsRemaining: 0, refusal: caller.refusal }
  }

  let result: CommitShotResult
  try {
    result = await deps.commit({
      photoId: input.photoId,
      tokenHash: caller.tokenHash,
      width: input.width,
      height: input.height,
      byteSize: input.byteSize,
      takenAt: input.takenAt,
    })
  } catch (error) {
    finish(
      { outcome: 'error', reason: 'commit', error },
      caller.tokenHash,
      caller.eventId,
    )
    throw error
  }

  if (!result.committed) {
    const refusal = result.refusal ?? 'not_matched'
    finish(
      { outcome: 'refused', reason: refusal },
      caller.tokenHash,
      caller.eventId,
    )
    return { committed: false, shotsRemaining: result.shotsRemaining, refusal }
  }

  finish(
    { outcome: 'committed', reason: null },
    caller.tokenHash,
    caller.eventId,
  )
  return { committed: true, shotsRemaining: result.shotsRemaining }
}

/**
 * Start a report now and let the platform wait for it. Neither the task nor
 * `defer` can throw into the caller.
 */
function background(deps: CommitObservationDeps, task: () => Promise<unknown>) {
  const running = Promise.resolve()
    .then(task)
    .catch((error: unknown) => {
      console.warn('Commit telemetry did not send', error)
    })
  try {
    deps.defer(() => running)
  } catch (error) {
    // Outside a request scope `after` throws. The report is already running;
    // it just has nobody holding the invocation open for it.
    console.warn('Commit telemetry could not be deferred', error)
  }
}

/** The production wiring. Only `identify` differs between guest and host. */
export function liveCommitDeps(
  identify: CommitObservationDeps['identify'],
): CommitObservationDeps {
  return {
    identify,
    commit: commitShot,
    inspect: inspectCommittedRow,
    report: reportServerEvent,
    reportIssue: reportServerIssue,
    defer: (task) => after(task),
    now: () => Date.now(),
  }
}

/**
 * The photo row as the report needs it. Ownership is compared here, on the
 * server, so the token hash never leaves this function — only the boolean.
 */
async function inspectCommittedRow(
  photoId: string,
  tokenHash: string | null,
): Promise<CommittedRow> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('photos')
    .select(
      'event_id, idempotency_key, status, participant:participants!photos_participant_id_fkey(session_token_hash)',
    )
    .eq('id', photoId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    eventId: data.event_id,
    captureId: data.idempotency_key,
    status: data.status,
    owned:
      Boolean(tokenHash) && data.participant?.session_token_hash === tokenHash,
  }
}
