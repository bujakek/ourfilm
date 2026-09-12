import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ReservedShot } from '@/lib/capture'
import { reportGraceReservation } from '@/lib/grace-telemetry'
import type { reportServerEvent } from '@/lib/telemetry-server'

const EVENT = 'f930e8f1-3294-4e0a-9855-9d94e5628cb0'
const CAPTURE = '677f29bf-23bd-427e-a8b2-a9ceb7f01857'

function shot(grace: ReservedShot['grace']): ReservedShot {
  const slot = { path: `${EVENT}/photo.jpg`, token: 'signed' }
  return {
    photoId: 'b359f2dd-9a07-4653-8c3b-78c5e2cfdce5',
    shotsRemaining: 3,
    grace,
    uploads: { full: slot, view: slot, thumb: slot },
  }
}

function setup() {
  const tasks: Array<() => Promise<unknown>> = []
  const report = vi.fn(async () => undefined)
  const deps = {
    defer: vi.fn((task: () => Promise<unknown>) => {
      tasks.push(task)
    }),
    report: report as unknown as typeof reportServerEvent,
  }
  return { deps, report, run: () => Promise.all(tasks.map((task) => task())) }
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('a reservation the upload grace let in', () => {
  it('is reported with how late it was and what the device claimed', async () => {
    const t = setup()
    reportGraceReservation(
      {
        eventId: EVENT,
        captureId: CAPTURE,
        surface: 'guest',
        shot: shot({ lateSeconds: 5_400, claimedLeadSeconds: 60 }),
      },
      t.deps,
    )
    await t.run()

    expect(t.report).toHaveBeenCalledWith('shot_reserved_in_grace', {
      event_id: EVENT,
      capture_id: CAPTURE,
      surface: 'guest',
      late_seconds: 5_400,
      claimed_lead_seconds: 60,
    })
  })

  it('is the only reservation reported', () => {
    // In-window reservations and replays carry no grace, and counting them
    // would bury the few the grace actually saved.
    const t = setup()
    reportGraceReservation(
      { eventId: EVENT, captureId: CAPTURE, surface: 'host', shot: shot(null) },
      t.deps,
    )

    expect(t.deps.defer).not.toHaveBeenCalled()
    expect(t.report).not.toHaveBeenCalled()
  })

  it('cannot throw into the reserve action', () => {
    const t = setup()
    t.deps.defer.mockImplementation(() => {
      throw new Error('outside a request scope')
    })

    expect(() =>
      reportGraceReservation(
        {
          eventId: EVENT,
          captureId: CAPTURE,
          surface: 'guest',
          shot: shot({ lateSeconds: 1, claimedLeadSeconds: null }),
        },
        t.deps,
      ),
    ).not.toThrow()
  })
})
