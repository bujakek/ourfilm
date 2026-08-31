import {
  buildAuthVerificationUrl,
  renderAuthEmail,
  resolveAuthEmailLocale,
} from '@/lib/auth-email'
import { Webhook } from 'standardwebhooks'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/auth/send-email/route'

describe('auth email locale', () => {
  it('prefers the request locale over stored user metadata', () => {
    expect(
      resolveAuthEmailLocale(
        'https://ourfilm.app/auth/callback?next=%2Fhost&lang=en',
        { locale: 'hu' },
      ),
    ).toBe('en')
  })

  it('understands links created before the direct lang parameter', () => {
    expect(
      resolveAuthEmailLocale(
        'https://ourfilm.app/auth/callback?next=%2Fhost%3Flang%3Den',
        null,
      ),
    ).toBe('en')
  })

  it('uses metadata and then the Hungarian legacy default as fallbacks', () => {
    expect(resolveAuthEmailLocale(undefined, { locale: 'en' })).toBe('en')
    expect(resolveAuthEmailLocale(undefined, {})).toBe('hu')
    expect(resolveAuthEmailLocale('not a valid url%', { locale: 'hu' })).toBe(
      'hu',
    )
  })
})

describe('auth email rendering', () => {
  const confirmationUrl = buildAuthVerificationUrl(
    'https://project.supabase.co',
    {
      tokenHash: 'token hash',
      redirectTo:
        'https://ourfilm.app/auth/callback?next=%2Fauth%2Fevent-complete&lang=en',
      action: 'magiclink',
    },
  )

  it('renders an English-only email', () => {
    const email = renderAuthEmail({
      locale: 'en',
      action: 'magiclink',
      confirmationUrl,
      redirectTo:
        'https://ourfilm.app/auth/callback?next=%2Fauth%2Fevent-complete&lang=en',
    })

    expect(email.subject).toBe('Your OurFilm sign-in link')
    expect(email.html).toContain('<html lang="en">')
    expect(email.html).toContain('Open it in the same browser')
    expect(email.html).not.toContain('Belép')
    expect(email.html).not.toContain('Ugyanabban')
  })

  it('renders a Hungarian-only email', () => {
    const email = renderAuthEmail({
      locale: 'hu',
      action: 'signup',
      confirmationUrl,
    })

    expect(email.subject).toBe('Erősítsd meg az e-mail-címed — OurFilm')
    expect(email.html).toContain('<html lang="hu">')
    expect(email.html).toContain('Fiók létrehozása')
    expect(email.html).not.toContain('Create account')
    expect(email.html).not.toContain('One more step')
  })

  it('builds the Supabase verification link without losing its redirect', () => {
    const url = new URL(confirmationUrl)

    expect(url.pathname).toBe('/auth/v1/verify')
    expect(url.searchParams.get('token')).toBe('token hash')
    expect(url.searchParams.get('type')).toBe('magiclink')
    expect(url.searchParams.get('redirect_to')).toContain(
      '/auth/callback?next=',
    )
  })
})

describe('Supabase Send Email Hook', () => {
  const secret = `whsec_${Buffer.from('ourfilm-test-hook-secret').toString('base64')}`
  const originalEnv = {
    hookSecret: process.env.SEND_EMAIL_HOOK_SECRET,
    resendKey: process.env.RESEND_API_KEY,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    from: process.env.AUTH_EMAIL_FROM,
  }

  function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }

  afterEach(() => {
    vi.unstubAllGlobals()
    restoreEnv('SEND_EMAIL_HOOK_SECRET', originalEnv.hookSecret)
    restoreEnv('RESEND_API_KEY', originalEnv.resendKey)
    restoreEnv('NEXT_PUBLIC_SUPABASE_URL', originalEnv.supabaseUrl)
    restoreEnv('AUTH_EMAIL_FROM', originalEnv.from)
  })

  function signedRequest(locale: 'en' | 'hu') {
    const payload = JSON.stringify({
      user: {
        email: 'host@example.com',
        user_metadata: { locale: locale === 'en' ? 'hu' : 'en' },
      },
      email_data: {
        token_hash: 'signed-token-hash',
        redirect_to: `https://ourfilm.app/auth/callback?next=%2Fhost&lang=${locale}`,
        email_action_type: 'magiclink',
      },
    })
    const id = `auth-email-${locale}`
    const now = new Date()

    return new Request('https://ourfilm.app/api/auth/send-email', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'webhook-id': id,
        'webhook-timestamp': String(Math.floor(now.getTime() / 1_000)),
        'webhook-signature': new Webhook(secret).sign(id, now, payload),
      },
      body: payload,
    })
  }

  it('verifies the hook and sends exactly one selected language', async () => {
    process.env.SEND_EMAIL_HOOK_SECRET = `v1,${secret}`
    process.env.RESEND_API_KEY = 're_test'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    process.env.AUTH_EMAIL_FROM = 'OurFilm <auth@ourfilm.app>'

    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 'email-id' }), { status: 200 }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const response = await POST(signedRequest('en'))

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledOnce()
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const sent = JSON.parse(String(init.body)) as {
      subject: string
      html: string
      to: string[]
    }
    expect(sent.to).toEqual(['host@example.com'])
    expect(sent.subject).toBe('Your OurFilm sign-in link')
    expect(sent.html).toContain('<html lang="en">')
    expect(sent.html).not.toContain('Belép')
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe(
      'auth-email-en',
    )
  })

  it('rejects an unsigned request without contacting Resend', async () => {
    process.env.SEND_EMAIL_HOOK_SECRET = secret
    process.env.RESEND_API_KEY = 're_test'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const response = await POST(
      new Request('https://ourfilm.app/api/auth/send-email', {
        method: 'POST',
        body: '{}',
      }),
    )

    expect(response.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
