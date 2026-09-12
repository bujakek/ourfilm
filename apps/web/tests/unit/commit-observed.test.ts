/**
 * The commit action's observation: every ending reported, none of it able to
 * change what the caller is told.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  type CommitObservationDeps,
  type CommittedRow,
  observeCommitShot,
} from '@/lib/commit-observed'
import { photoRef } from '@/lib/photo-ref'

const PHOTO = 'b359f2dd-9a07-4653-8c3b-78c5e2cfdce5'
const EVENT = 'f930e8f1-3294-4e0a-9855-9d94e5628cb0'
const CAPTURE = '677f29bf-23bd-427e-a8b2-a9ceb7f01857'
const ATTEMPT = '0b6f3c5e-6a0e-4d7e-9a53-3c1f1d2e4b5a'
const TOKEN_HASH = 'c0ffee'.repeat(10) + 'beef'

const input = {
  photoId: PHOTO,
  width: 3200,
  height: 2400,
  byteSize: 2_000_000,
  takenAt: '2026-09-12T18:21:39.983Z',
  captureId: CAPTURE,
  attemptId: ATTEMPT,
}

const ownedRow = (status = 'ready'): NonNullable<CommittedRow> => ({
  eventId: EVENT,
  captureId: CAPTURE,
  status,
  owned: true,
})

function setup(overrides: Partial<CommitObservationDeps> = {}) {
  const tasks: Array<() => Promise<unknown>> = []
  const report = vi.fn<(...args: unknown[]) => Promise<void>>(
    async () => undefined,
  )
  const deps: CommitObservationDeps = {
    identify: vi.fn(async () => ({
      ok: true as const,
      tokenHash: TOKEN_HASH,
      eventId: null,
    })),
    commit: vi.fn(async () => ({ committed: true, shotsRemaining: 7 })),
    inspect: vi.fn(async () => ownedRow()),
    report: report as unknown as CommitObservationDeps['report'],
    reportIssue: vi.fn(async () => undefined),
    defer: vi.fn((task: () => Promise<unknown>) => {
      tasks.push(task)
    }),
    now: vi.fn(() => 1_000),
    ...overrides,
  }

  return {
    deps,
    /** What `after` would have waited for. */
    settled: () => Promise.all(tasks.map((task) => task())),
    reported(event: string) {
      return (deps.report as unknown as typeof report).mock.calls
        .filter(([name]) => name === event)
        .map(([, properties]) => properties as Record<string, unknown>)
    },
  }
}

function run(deps: CommitObservationDeps, surface: 'guest' | 'host' = 'guest') {
  return observeCommitShot({ surface, route: '/e/[slug]', input, deps })
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('a commit that lands', () => {
  it('answers exactly what the RPC said, and reports arrival and success', async () => {
    const t = setup()

    await expect(run(t.deps)).resolves.toEqual({
      committed: true,
      shotsRemaining: 7,
    })
    await t.settled()

    expect(t.deps.commit).toHaveBeenCalledWith({
      photoId: PHOTO,
      tokenHash: TOKEN_HASH,
      width: 3200,
      height: 2400,
      byteSize: 2_000_000,
      takenAt: '2026-09-12T18:21:39.983Z',
    })

    const ref = await photoRef(PHOTO)
    expect(t.reported('commit_shot_received')).toEqual([
      {
        surface: 'guest',
        photo_ref: ref,
        claimed_capture_id: CAPTURE,
        attempt_id: ATTEMPT,
      },
    ])
    expect(t.reported('commit_shot_finished')).toEqual([
      expect.objectContaining({
        surface: 'guest',
        // From the row, not from the request.
        event_id: EVENT,
        capture_id: CAPTURE,
        capture_id_matches: true,
        attempt_id: ATTEMPT,
        photo_ref: ref,
        outcome: 'committed',
        reason: null,
        error_name: null,
        row: 'owned',
        status_after: 'ready',
      }),
    ])
    expect(t.deps.reportIssue).not.toHaveBeenCalled()
  })

  it('never reports the photo id or the token hash', async () => {
    const t = setup()
    await run(t.deps)
    await t.settled()

    const sent = JSON.stringify(
      (t.deps.report as unknown as ReturnType<typeof vi.fn>).mock.calls,
    )
    // event_id + photo_id is the public address of the picture.
    expect(sent).not.toContain(PHOTO)
    expect(sent).not.toContain(TOKEN_HASH)
  })
})

describe('a commit refused before the RPC', () => {
  it('names a missing session, and still reads back the row it left', async () => {
    const t = setup({
      identify: vi.fn(async () => ({
        ok: false as const,
        refusal: 'no_session' as const,
      })),
      inspect: vi.fn(async () => ({ ...ownedRow('pending'), owned: false })),
    })

    await expect(run(t.deps)).resolves.toEqual({
      committed: false,
      shotsRemaining: 0,
      refusal: 'no_session',
    })
    await t.settled()

    expect(t.deps.commit).not.toHaveBeenCalled()
    expect(t.deps.inspect).toHaveBeenCalledWith(PHOTO, null)
    expect(t.reported('commit_shot_received')).toHaveLength(1)
    expect(t.reported('commit_shot_finished')).toEqual([
      expect.objectContaining({
        outcome: 'refused',
        reason: 'no_session',
        row: 'foreign',
        status_after: 'pending',
        event_id: EVENT,
      }),
    ])
  })

  it('tells a host who does not own the event from one with no participant', async () => {
    for (const refusal of ['not_owner', 'no_participant'] as const) {
      const t = setup({
        identify: vi.fn(async () => ({ ok: false as const, refusal })),
      })
      await expect(run(t.deps, 'host')).resolves.toMatchObject({ refusal })
      await t.settled()
      expect(t.reported('commit_shot_finished')).toEqual([
        expect.objectContaining({ surface: 'host', reason: refusal }),
      ])
    }
  })
})

describe('a commit the RPC refuses', () => {
  it('passes the reason on and says there is no such row', async () => {
    const t = setup({
      commit: vi.fn(async () => ({
        committed: false,
        shotsRemaining: 0,
        refusal: 'not_matched' as const,
      })),
      inspect: vi.fn(async () => null),
    })

    await expect(run(t.deps)).resolves.toEqual({
      committed: false,
      shotsRemaining: 0,
      refusal: 'not_matched',
    })
    await t.settled()

    expect(t.reported('commit_shot_finished')).toEqual([
      expect.objectContaining({
        outcome: 'refused',
        reason: 'not_matched',
        row: 'missing',
        status_after: null,
        capture_id: null,
        capture_id_matches: null,
      }),
    ])
  })
})

describe('a commit that throws', () => {
  const failure = {
    message: 'canceling statement due to statement timeout',
    details: '',
    hint: '',
    code: '57014',
  }

  it('rethrows the same error and reports it with the row’s event', async () => {
    const t = setup({
      commit: vi.fn(async () => {
        throw failure
      }),
      inspect: vi.fn(async () => ownedRow('pending')),
    })

    await expect(run(t.deps)).rejects.toBe(failure)
    await t.settled()

    // The guest's `server_error` used to carry no event at all.
    expect(t.deps.reportIssue).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({ operation: 'commit_shot', eventId: EVENT }),
    )
    expect(t.reported('commit_shot_finished')).toEqual([
      expect.objectContaining({
        outcome: 'error',
        reason: 'commit',
        error_name: 'PostgrestError:57014',
        row: 'owned',
        status_after: 'pending',
      }),
    ])
  })

  it('does not wait for the report before rethrowing', async () => {
    // posthog-node retries for most of a minute; the browser gives up on a
    // commit after twenty seconds. A report that never settles must not
    // hold the answer.
    const never = () => new Promise<never>(() => undefined)
    const t = setup({
      commit: vi.fn(async () => {
        throw failure
      }),
      reportIssue: vi.fn(never),
      report: vi.fn(never) as unknown as CommitObservationDeps['report'],
      inspect: vi.fn(never),
    })

    await expect(run(t.deps)).rejects.toBe(failure)
  })

  it('reports a failure to identify the caller as its own stage', async () => {
    const boom = new Error('cookies unavailable')
    const t = setup({
      identify: vi.fn(async () => {
        throw boom
      }),
    })

    await expect(run(t.deps)).rejects.toBe(boom)
    await t.settled()

    expect(t.deps.commit).not.toHaveBeenCalled()
    expect(t.deps.reportIssue).toHaveBeenCalledWith(
      boom,
      expect.objectContaining({ operation: 'commit_shot_identify' }),
    )
    expect(t.reported('commit_shot_finished')).toEqual([
      expect.objectContaining({ outcome: 'error', reason: 'identify' }),
    ])
  })
})

describe('telemetry that fails', () => {
  const broken: Array<[string, Partial<CommitObservationDeps>]> = [
    [
      'report throws synchronously',
      {
        report: vi.fn(() => {
          throw new Error('posthog')
        }) as unknown as CommitObservationDeps['report'],
      },
    ],
    [
      'report rejects',
      {
        report: vi.fn(async () => {
          throw new Error('posthog')
        }) as unknown as CommitObservationDeps['report'],
      },
    ],
    [
      'reportIssue rejects',
      {
        reportIssue: vi.fn(async () => {
          throw new Error('posthog')
        }),
      },
    ],
    [
      'the read-back rejects',
      {
        inspect: vi.fn(async () => {
          throw new Error('db')
        }),
      },
    ],
    [
      'after() is unavailable',
      {
        defer: vi.fn(() => {
          throw new Error('outside a request scope')
        }),
      },
    ],
  ]

  it.each(broken)(
    'leaves a successful commit successful when %s',
    async (_label, override) => {
      const t = setup(override)
      await expect(run(t.deps)).resolves.toEqual({
        committed: true,
        shotsRemaining: 7,
      })
      await expect(t.settled()).resolves.toBeDefined()
    },
  )

  it.each(broken)(
    'leaves a refusal a refusal when %s',
    async (_label, override) => {
      const t = setup({
        ...override,
        commit: vi.fn(async () => ({
          committed: false,
          shotsRemaining: 3,
          refusal: 'not_matched' as const,
        })),
      })
      await expect(run(t.deps)).resolves.toEqual({
        committed: false,
        shotsRemaining: 3,
        refusal: 'not_matched',
      })
      await t.settled()
    },
  )

  it.each(broken)(
    'leaves a thrown commit the same throw when %s',
    async (_label, override) => {
      const failure = new Error('rpc')
      const t = setup({
        ...override,
        commit: vi.fn(async () => {
          throw failure
        }),
      })
      await expect(run(t.deps)).rejects.toBe(failure)
      await t.settled()
    },
  )

  it('still reports the ending when only the read-back failed', async () => {
    const t = setup({
      identify: vi.fn(async () => ({
        ok: true as const,
        tokenHash: TOKEN_HASH,
        eventId: EVENT,
      })),
      inspect: vi.fn(async () => {
        throw new Error('db')
      }),
    })
    await run(t.deps, 'host')
    await t.settled()

    expect(t.reported('commit_shot_finished')).toEqual([
      expect.objectContaining({
        outcome: 'committed',
        row: 'unknown',
        // The host's event comes from their own session's ownership check.
        event_id: EVENT,
        capture_id: null,
      }),
    ])
  })
})
