import { beforeEach, expect, it, vi } from 'vitest'

import { completeSignIn } from '@/app/(product)/auth/callback/actions'

const { exchange, verifyOtp, rpc } = vi.hoisted(() => ({
  exchange: vi.fn(),
  verifyOtp: vi.fn(),
  rpc: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession: exchange, verifyOtp },
    rpc,
  }),
}))
vi.mock('@/lib/request-origin', () => ({
  requestOrigin: async () => 'https://ourfilm.app',
}))
vi.mock('next/navigation', () => ({
  RedirectType: { replace: 'replace' },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))
const { report } = vi.hoisted(() => ({ report: vi.fn() }))
vi.mock('@/lib/telemetry-server', () => ({ reportServerEvent: report }))

const google = {
  code: 'oauth-code',
  tokenHash: null,
  type: null,
  next: '/auth/event-complete',
  lang: 'hu',
  provider: 'google',
}

beforeEach(() => {
  exchange.mockReset().mockResolvedValue({ error: null })
  verifyOtp.mockReset().mockResolvedValue({ error: null })
  report.mockReset().mockResolvedValue(undefined)
  rpc.mockReset().mockResolvedValue({ error: null })
})

it('exchanges the Google code and continues creation without swallowing the redirect', async () => {
  await expect(completeSignIn(google)).rejects.toThrow(
    'NEXT_REDIRECT:/auth/event-complete',
  )
  expect(exchange).toHaveBeenCalledExactlyOnceWith('oauth-code')
  expect(verifyOtp).not.toHaveBeenCalled()
})

it('returns a failed code exchange to localized retry with the draft destination', async () => {
  exchange.mockResolvedValue({ error: new Error('Expired code') })
  await expect(completeSignIn(google)).rejects.toThrow(
    'NEXT_REDIRECT:/host/login?error=oauth&lang=hu&next=%2Fauth%2Fevent-complete',
  )
})

it('handles cancellation without exchanging an absent code', async () => {
  await expect(completeSignIn({ ...google, code: null })).rejects.toThrow(
    'error=oauth&lang=hu',
  )
  expect(exchange).not.toHaveBeenCalled()
})

it('still accepts existing magic links', async () => {
  await expect(
    completeSignIn({
      ...google,
      provider: null,
      code: null,
      tokenHash: 'email-token',
      type: 'magiclink',
      next: '/host?lang=hu',
    }),
  ).rejects.toThrow('NEXT_REDIRECT:/host?lang=hu')
  expect(verifyOtp).toHaveBeenCalledExactlyOnceWith({
    token_hash: 'email-token',
    type: 'magiclink',
  })
})

it('never redirects a signed-in host to an external next URL', async () => {
  await expect(
    completeSignIn({ ...google, next: '//evil.example' }),
  ).rejects.toThrow('NEXT_REDIRECT:/host')
})

it('reports how the sign-in ended, before the redirect throws', async () => {
  await expect(completeSignIn(google)).rejects.toThrow('NEXT_REDIRECT')
  expect(report).toHaveBeenCalledExactlyOnceWith('sign_in_settled', {
    method: 'google',
    outcome: 'signed_in',
  })

  report.mockClear()
  exchange.mockResolvedValue({ error: new Error('Expired code') })
  await expect(completeSignIn(google)).rejects.toThrow('NEXT_REDIRECT')
  expect(report).toHaveBeenCalledExactlyOnceWith('sign_in_settled', {
    method: 'google',
    outcome: 'failed',
  })
})

it('never echoes an invented provider into the reported method', async () => {
  await expect(
    completeSignIn({ ...google, provider: 'facebook' }),
  ).rejects.toThrow('NEXT_REDIRECT')
  expect(report).toHaveBeenCalledExactlyOnceWith('sign_in_settled', {
    method: 'email',
    outcome: 'signed_in',
  })
})

it('records the arrival language without overriding a chosen one', async () => {
  // Google carries none of our metadata, so this is where its first
  // profile language comes from — and only if the host has none yet.
  await expect(completeSignIn(google)).rejects.toThrow('NEXT_REDIRECT')
  expect(rpc).toHaveBeenCalledExactlyOnceWith('set_host_locale', {
    p_locale: 'hu',
    p_only_if_unset: true,
  })
})

it('never lets a failed language write cost the sign-in', async () => {
  rpc.mockResolvedValue({ error: new Error('unavailable') })
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  await expect(completeSignIn(google)).rejects.toThrow(
    'NEXT_REDIRECT:/auth/event-complete',
  )
})

it('records nothing for a failed sign-in or an unknown language', async () => {
  exchange.mockResolvedValue({ error: new Error('Expired code') })
  await expect(completeSignIn(google)).rejects.toThrow('NEXT_REDIRECT')
  exchange.mockResolvedValue({ error: null })
  await expect(completeSignIn({ ...google, lang: 'de' })).rejects.toThrow(
    'NEXT_REDIRECT',
  )
  expect(rpc).not.toHaveBeenCalled()
})
