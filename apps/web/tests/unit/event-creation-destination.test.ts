import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  result: vi.fn(),
  insert: vi.fn(),
  checkout: vi.fn(),
  user: { id: 'owner-id', email: 'host@example.com' } as {
    id: string
    email: string
  } | null,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        insert: (value: unknown) => {
          mocks.insert(value)
          return query
        },
        maybeSingle: mocks.result,
      }
      return query
    },
  }),
}))
vi.mock('@/lib/stripe/checkout', () => ({
  createEventCheckoutUrl: mocks.checkout,
}))
vi.mock('@/lib/telemetry-server', () => ({
  reportServerEvent: vi.fn(),
  reportServerIssue: vi.fn(),
}))

import {
  createEventFromDraft,
  type EventDraftInput,
} from '@/app/(product)/host/events/new/actions'

const input: EventDraftInput = {
  locale: 'hu',
  name: 'Wedding',
  endLocal: '2026-10-08T18:00',
  timeZone: 'Europe/Budapest',
  revealMode: 'event_end',
  shots: 24,
  plan: 'full',
  guestsCanView: true,
  legalAccepted: true,
  creationKey: '12345678-1234-4234-8234-123456789abc',
}
const saved = { id: 'event-id', slug: 'saved-event' }

describe('saving before payment', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-07T10:00:00Z'))
    vi.clearAllMocks()
    mocks.result.mockReset()
    mocks.user = { id: 'owner-id', email: 'host@example.com' }
  })
  afterEach(() => vi.useRealTimers())

  it.each(['hu', 'en'])(
    'saves a paid draft without a country, then confirms payment in %s',
    async (locale) => {
      mocks.result
        .mockResolvedValueOnce({ data: null })
        .mockResolvedValueOnce({ data: saved })
      expect(await createEventFromDraft({ ...input, locale })).toEqual({
        ok: true,
        destination: `/host/events/saved-event/checkout?lang=${locale}`,
      })
      expect(mocks.insert).toHaveBeenCalledTimes(1)
      expect(mocks.checkout).not.toHaveBeenCalled()
    },
  )

  it('sends a free draft straight to its saved event', async () => {
    mocks.result
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: saved })
    expect(await createEventFromDraft({ ...input, plan: 'free' })).toEqual({
      ok: true,
      destination: '/host/events/saved-event?lang=hu',
    })
    expect(mocks.checkout).not.toHaveBeenCalled()
  })

  it('keeps the payment destination when resuming an already-created draft', async () => {
    mocks.result.mockResolvedValueOnce({ data: saved })
    expect(await createEventFromDraft(input)).toEqual({
      ok: true,
      destination: '/host/events/saved-event/checkout?lang=hu',
    })
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(mocks.checkout).not.toHaveBeenCalled()
  })

  it('keeps the payment destination when simultaneous creation loses the unique-key race', async () => {
    mocks.result
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'events_owner_creation_key_idx' },
      })
      .mockResolvedValueOnce({ data: saved })
    expect(await createEventFromDraft(input)).toEqual({
      ok: true,
      destination: '/host/events/saved-event/checkout?lang=hu',
    })
    expect(mocks.checkout).not.toHaveBeenCalled()
  })

  it('requires sign-in before saving or starting payment', async () => {
    mocks.user = null
    expect(await createEventFromDraft(input)).toMatchObject({
      ok: false,
      reason: 'auth',
    })
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
})
