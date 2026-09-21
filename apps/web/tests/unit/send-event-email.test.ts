import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendNextEventEmail } from '@/lib/email/send-event-email'

function database({
  payload = null,
  saveError = null,
  sentError = null,
  empty = false,
  kind = 'ended',
  settings = {},
}: {
  payload?: Record<string, unknown> | null
  saveError?: Error | null
  sentError?: Error | null
  empty?: boolean
  kind?: string
  settings?: Record<string, unknown>
} = {}) {
  const writes: Record<string, unknown>[] = []
  const row = {
    id: 'mail-123',
    kind,
    payload,
    snapshot: {
      locale: 'en',
      eventName: 'Party',
      slug: 'party-123',
      recipient: 'host@example.com',
      photoCount: 12,
      ...settings,
    },
  }
  return {
    writes,
    db: {
      rpc: () => ({
        maybeSingle: async () => ({ data: empty ? null : row, error: null }),
      }),
      from: () => ({
        update: (values: Record<string, unknown>) => {
          writes.push(values)
          const builder = {
            eq: () => builder,
            select: () => builder,
            maybeSingle: async () => ({
              data: { id: row.id },
              error: saveError,
            }),
            then: (resolve: (value: unknown) => unknown) =>
              resolve({ error: sentError }),
          }
          return builder
        },
      }),
    } as unknown as Parameters<typeof sendNextEventEmail>[0],
  }
}

describe('event email delivery', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    vi.stubEnv('RESEND_API_KEY', 'test-key')
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset().mockResolvedValue(new Response('{}', { status: 200 }))
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('persists the exact body before sending and records success afterwards', async () => {
    const { db, writes } = database()
    fetchMock.mockImplementation(async (_url, options) => {
      expect(writes).toHaveLength(1)
      expect(JSON.parse(options.body)).toEqual(writes[0].payload)
      expect(options.headers['Idempotency-Key']).toBe('event-email-mail-123')
      expect(options.signal).toBeInstanceOf(AbortSignal)
      return new Response('{}')
    })
    expect(await sendNextEventEmail(db)).toBe('sent')
    expect(writes[1].sent_at).toEqual(expect.any(String))
  })

  it('replays a saved body without changing the key or regenerating content', async () => {
    const payload = {
      subject: 'Original',
      to: ['original@example.com'],
      html: '<p>Original</p>',
    }
    const { db, writes } = database({ payload })
    await sendNextEventEmail(db)
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify(payload))
    expect(fetchMock.mock.calls[0][1].headers['Idempotency-Key']).toBe(
      'event-email-mail-123',
    )
    expect(writes).toHaveLength(1)
  })

  it('never sends if persisting the body fails', async () => {
    const { db } = database({ saveError: new Error('DB unavailable') })
    await expect(sendNextEventEmail(db)).rejects.toThrow('DB unavailable')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([429, 500])(
    'leaves a refused %i send unmarked for retry',
    async (status) => {
      const { db, writes } = database()
      fetchMock.mockResolvedValue(new Response('{}', { status }))
      await expect(sendNextEventEmail(db)).rejects.toThrow('provider refused')
      expect(writes.every((w) => !w.sent_at)).toBe(true)
    },
  )

  it('surfaces a failed success write so the same key is retried', async () => {
    const { db } = database({ sentError: new Error('Write failed') })
    await expect(sendNextEventEmail(db)).rejects.toThrow('Write failed')
  })

  it('does nothing when no email is due', async () => {
    expect(await sendNextEventEmail(database({ empty: true }).db)).toBe('empty')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends the creation confirmation from its stored event settings', async () => {
    const { db } = database({
      kind: 'created',
      settings: {
        captureEndAt: '2026-09-27T02:00:00+00:00',
        revealAt: '2026-09-27T02:00:00+00:00',
        revealMode: 'event_end',
        timeZone: 'Europe/Budapest',
        guestsCanView: true,
      },
    })
    expect(await sendNextEventEmail(db)).toBe('sent')
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(payload.subject).toBe('Your camera is ready: Party')
    expect(payload.text).toContain('04:00')
    expect(payload.to).toEqual(['host@example.com'])
  })
})
