import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import {
  LOCALE_PREFERENCE_COOKIE,
  negotiateLocale,
  rootLocale,
} from '@/lib/locale-preference'
import { proxy } from '@/proxy'

describe('Accept-Language negotiation', () => {
  it.each([
    ['hu-HU,hu;q=0.9,en;q=0.8', 'hu'],
    ['en-GB,en;q=0.9,hu;q=0.8', 'en'],
    // Priorities, not order.
    ['en;q=0.4,hu;q=0.9', 'hu'],
    // Unsupported languages are skipped rather than ending the search.
    ['de-DE,de;q=0.9,hu;q=0.5', 'hu'],
    // A refusal is not a preference.
    ['hu;q=0,en;q=0.1', 'en'],
    // Ties keep the header's order.
    ['hu;q=0.5,en;q=0.5', 'hu'],
  ])('%s → %s', (header, expected) => {
    expect(negotiateLocale(header)).toBe(expected)
  })

  it.each([[''], ['*'], ['de,fr;q=0.8'], [null]])(
    'finds nothing in %s',
    (header) => {
      expect(negotiateLocale(header)).toBeNull()
    },
  )
})

describe('root locale', () => {
  it('prefers a saved choice over the browser', () => {
    expect(rootLocale({ cookie: 'en', acceptLanguage: 'hu-HU' })).toBe('en')
  })

  it('ignores a saved value it does not serve', () => {
    expect(rootLocale({ cookie: 'de', acceptLanguage: 'hu-HU' })).toBe('hu')
  })

  it('falls back to English', () => {
    expect(rootLocale({ cookie: null, acceptLanguage: 'ja-JP' })).toBe('en')
    expect(rootLocale({ cookie: null, acceptLanguage: null })).toBe('en')
  })
})

function get(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { headers })
}

describe('proxy on /', () => {
  it('redirects temporarily, keeping the query', async () => {
    const response = await proxy(
      get('https://ourfilm.app/?utm_source=ig&utm_campaign=x', {
        'accept-language': 'hu-HU,hu;q=0.9',
      }),
    )
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://ourfilm.app/hu?utm_source=ig&utm_campaign=x',
    )
  })

  it('is never cached for the next visitor', async () => {
    const response = await proxy(get('https://ourfilm.app/'))
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('vary')).toBe('Cookie, Accept-Language')
    expect(response.headers.get('location')).toBe('https://ourfilm.app/en')
  })

  it('follows the saved switcher choice', async () => {
    const response = await proxy(
      get('https://ourfilm.app/', {
        'accept-language': 'en-US',
        cookie: `${LOCALE_PREFERENCE_COOKIE}=hu`,
      }),
    )
    expect(response.headers.get('location')).toBe('https://ourfilm.app/hu')
  })

  it('leaves an explicit locale URL alone', async () => {
    const response = await proxy(
      get('https://ourfilm.app/hu', {
        'accept-language': 'en-US',
        cookie: `${LOCALE_PREFERENCE_COOKIE}=en`,
      }),
    )
    expect(response.headers.get('location')).toBeNull()
    expect(response.status).toBe(200)
  })
})
