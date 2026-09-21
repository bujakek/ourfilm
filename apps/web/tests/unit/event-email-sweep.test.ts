import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  admin: vi.fn(),
  report: vi.fn(),
  event: vi.fn(),
}))
vi.mock('@/lib/email/send-event-email', () => ({
  sendNextEventEmail: mocks.send,
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.admin }))
vi.mock('@/lib/telemetry-server', () => ({
  reportServerIssue: mocks.report,
  reportServerEvent: mocks.event,
}))

import { POST } from '@/app/api/event-emails/sweep/route'

describe('event email sweep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('EXPORT_WORKER_SECRET', 'test-worker-secret')
    vi.stubEnv('RESEND_API_KEY', 'test-email-key')
    vi.stubEnv('OURFILM_EVENT_EMAILS', 'true')
    mocks.send.mockReset().mockResolvedValue('empty')
    mocks.admin.mockReturnValue({})
    mocks.report.mockResolvedValue(undefined)
    mocks.event.mockResolvedValue(undefined)
  })
  afterEach(() => vi.unstubAllEnvs())
  function request(secret = 'test-worker-secret') {
    return new Request('https://ourfilm.app/api/event-emails/sweep', {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
    })
  }

  it('rejects unauthorized callers before touching the database', async () => {
    expect((await POST(request('wrong'))).status).toBe(401)
    expect(mocks.admin).not.toHaveBeenCalled()
    expect(mocks.send).not.toHaveBeenCalled()
    // Nothing unauthenticated may write to the schedule's own health signal.
    expect(mocks.event).not.toHaveBeenCalled()
  })

  it('does not claim mail when delivery is disabled or unconfigured', async () => {
    vi.stubEnv('OURFILM_EVENT_EMAILS', 'false')
    expect(await (await POST(request())).json()).toMatchObject({
      skipped: 'event_emails_disabled',
    })
    vi.stubEnv('OURFILM_EVENT_EMAILS', 'true')
    vi.stubEnv('RESEND_API_KEY', '')
    expect((await POST(request())).status).toBe(503)
    expect(mocks.admin).not.toHaveBeenCalled()
    // A paused schedule still beats, and says why it did nothing.
    expect(mocks.event.mock.calls.map((call) => call[1].skipped)).toEqual([
      'event_emails_disabled',
      'email_not_configured',
    ])
  })

  it('bounds the batch and reports success', async () => {
    mocks.send.mockResolvedValue('sent')
    expect(await (await POST(request())).json()).toEqual({
      ok: true,
      sent: 3,
      failed: 0,
    })
    expect(mocks.send).toHaveBeenCalledTimes(3)
    expect(mocks.event).toHaveBeenCalledWith('event_email_sweep', {
      sent: 3,
      failed: 0,
      skipped: null,
    })
  })

  it('reports a failed delivery and continues with other due mail', async () => {
    mocks.send
      .mockRejectedValueOnce(new Error('Provider unavailable'))
      .mockResolvedValueOnce('sent')
      .mockResolvedValueOnce('empty')
    const response = await POST(request())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ ok: false, sent: 1, failed: 1 })
    expect(mocks.report).toHaveBeenCalledOnce()
    expect(mocks.event).toHaveBeenCalledWith('event_email_sweep', {
      sent: 1,
      failed: 1,
      skipped: null,
    })
  })

  it('still reports a heartbeat when the run itself throws', async () => {
    mocks.admin.mockImplementation(() => {
      throw new Error('No service role key')
    })
    expect((await POST(request())).status).toBe(500)
    expect(mocks.report).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ operation: 'event_email_sweep' }),
    )
    expect(mocks.event).toHaveBeenCalledWith('event_email_sweep', {
      sent: 0,
      failed: 0,
      skipped: null,
    })
  })
})
