import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { signInWithGoogle } from '@/lib/auth-google'
import { authFailureUrl } from '@/lib/auth-redirect'

const { oauth } = vi.hoisted(() => ({ oauth: vi.fn() }))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signInWithOAuth: oauth } }),
}))

beforeEach(() => {
  oauth.mockReset().mockResolvedValue({ error: null })
  vi.stubGlobal('window', { location: { origin: 'http://localhost:3000' } })
})
afterEach(() => vi.unstubAllGlobals())

describe('Google sign-in', () => {
  it.each(['hu', 'en'] as const)(
    'keeps the %s draft on the originating browser and site',
    async (locale) => {
      expect(
        await signInWithGoogle({ next: '/auth/event-complete', locale }),
      ).toEqual({ status: 'redirecting' })
      const call = oauth.mock.calls[0][0]
      const callback = new URL(call.options.redirectTo)
      expect(call.provider).toBe('google')
      expect(callback.origin).toBe('http://localhost:3000')
      expect(callback.pathname).toBe('/auth/callback')
      expect(callback.searchParams.get('next')).toBe('/auth/event-complete')
      expect(callback.searchParams.get('lang')).toBe(locale)
      expect(callback.searchParams.get('provider')).toBe('google')
    },
  )

  it.each(['response', 'network'])(
    'allows retry after a %s failure',
    async (failure) => {
      if (failure === 'network')
        oauth.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      else
        oauth.mockResolvedValueOnce({ error: { message: 'Provider disabled' } })
      const result = await signInWithGoogle({ next: '/host', locale: 'hu' })
      expect(result.status).toBe('error')
      expect(await signInWithGoogle({ next: '/host', locale: 'hu' })).toEqual({
        status: 'redirecting',
      })
    },
  )
})

describe('sign-in recovery', () => {
  it('retains locale and draft destination after Google cancellation', () => {
    const url = new URL(
      authFailureUrl({
        origin: 'https://ourfilm.app',
        next: '/auth/event-complete',
        lang: 'hu',
        provider: 'google',
      }),
      'https://ourfilm.app',
    )
    expect(url.pathname).toBe('/host/login')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      error: 'oauth',
      lang: 'hu',
      next: '/auth/event-complete',
    })
  })

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/\t/evil.example',
  ])('rejects an external return destination: %s', (next) => {
    const url = new URL(
      authFailureUrl({
        origin: 'https://ourfilm.app',
        next,
        lang: 'en',
        provider: 'google',
      }),
      'https://ourfilm.app',
    )
    expect(url.searchParams.get('next')).toBe('/host')
  })

  it('keeps email-link errors distinct and defaults to a localized host page', () => {
    const url = new URL(
      authFailureUrl({
        origin: 'https://ourfilm.app',
        next: null,
        lang: 'hu',
        provider: null,
      }),
      'https://ourfilm.app',
    )
    expect(url.searchParams.get('error')).toBe('link')
    expect(url.searchParams.get('next')).toBe('/host?lang=hu')
  })
})
