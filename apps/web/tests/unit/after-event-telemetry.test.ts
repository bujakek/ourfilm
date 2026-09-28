import { describe, expect, it, vi } from 'vitest'

import { reportAfterEventReservation } from '@/lib/after-event-telemetry'
import type { ReservedShot, ReserveResult } from '@/lib/capture'
import type { reportServerEvent } from '@/lib/telemetry-server'

const EVENT = 'f930e8f1-3294-4e0a-9855-9d94e5628cb0'
const CAPTURE = '677f29bf-23bd-427e-a8b2-a9ceb7f01857'

function admitted(afterEvent: ReservedShot['afterEvent']): ReserveResult {
  const slot = { path: `${EVENT}/photo.jpg`, token: 'signed' }
  return {
    ok: true,
    shot: {
      photoId: 'b359f2dd-9a07-4653-8c3b-78c5e2cfdce5',
      shotsRemaining: 6,
      grace: null,
      afterEvent,
      progress: null,
      uploads: { full: slot, view: slot, thumb: slot },
    },
  }
}

function setup(joined: boolean | null | Error = true) {
  const tasks: Array<() => Promise<unknown>> = []
  const report = vi.fn(async () => undefined)
  const deps = {
    defer: vi.fn((task: () => Promise<unknown>) => {
      tasks.push(task)
    }),
    report: report as unknown as typeof reportServerEvent,
    joinedAfterClose: vi.fn(async () => {
      if (joined instanceof Error) throw joined
      return joined
    }),
  }
  return { deps, report, run: () => Promise.all(tasks.map((task) => task())) }
}

const input = (result: ReserveResult) => ({
  eventId: EVENT,
  captureId: CAPTURE,
  tokenHash: 'hash',
  result,
})

describe('after-event reservation telemetry', () => {
  it('reports an admitted reservation with its lateness and the join', async () => {
    const t = setup(true)
    reportAfterEventReservation(input(admitted({ lateSeconds: 5400 })), t.deps)
    expect(t.report).not.toHaveBeenCalled()
    await t.run()
    expect(t.report).toHaveBeenCalledWith('after_event_reserve', {
      event_id: EVENT,
      capture_id: CAPTURE,
      outcome: 'admitted',
      late_seconds: 5400,
      shots_remaining: 6,
      joined_after_close: true,
    })
  })

  it('reports a refusal by name', async () => {
    const t = setup()
    reportAfterEventReservation(input({ ok: false, refusal: 'ended' }), t.deps)
    await t.run()
    expect(t.report).toHaveBeenCalledWith(
      'after_event_reserve',
      expect.objectContaining({ outcome: 'ended', late_seconds: null }),
    )
    expect(t.deps.joinedAfterClose).not.toHaveBeenCalled()
  })

  it('does not count a replay', async () => {
    const t = setup()
    reportAfterEventReservation(input(admitted(null)), t.deps)
    expect(t.deps.defer).not.toHaveBeenCalled()
  })

  it('still reports when the join lookup fails', async () => {
    const t = setup(new Error('db down'))
    reportAfterEventReservation(input(admitted({ lateSeconds: 60 })), t.deps)
    await t.run()
    expect(t.report).toHaveBeenCalledWith(
      'after_event_reserve',
      expect.objectContaining({
        outcome: 'admitted',
        joined_after_close: null,
      }),
    )
  })

  it('never throws into the action when deferring fails', () => {
    const t = setup()
    t.deps.defer.mockImplementation(() => {
      throw new Error('outside a request')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() =>
      reportAfterEventReservation(input(admitted({ lateSeconds: 1 })), t.deps),
    ).not.toThrow()
    warn.mockRestore()
  })
})
