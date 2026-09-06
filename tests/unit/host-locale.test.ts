import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * The precedence that makes a bookmarked `/host` render in the right language.
 *
 * `/host`, `/host/login` and `/auth` sit outside the locale tree and read
 * their language from `?lang`. Every link inside the product sets it, so the
 * gap only shows when something does not — a bookmark, a hand-typed URL, an
 * email client that dropped the query — and the fallback was `defaultLocale`,
 * which handed an English host a Hungarian dashboard.
 *
 * The order is the whole feature, so it is pinned rather than left to the
 * reading of an `??` chain: an explicit `?lang` is this request asking for
 * this page in that language and wins; the account's stored preference is what
 * makes the bookmark work; `defaultLocale` catches a signed-out visitor.
 */

const getUser = vi.fn()
const maybeSingle = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle }) }),
    }),
  }),
}))

// `server-only` throws when imported outside a Server Component build.
vi.mock('server-only', () => ({}))

const { hostLocale, getAccountLocale } = await import('@/lib/roles')

function signedIn(locale: string | null) {
  getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  maybeSingle.mockResolvedValue({
    data: locale === null ? null : { locale },
    error: null,
  })
}

function signedOut() {
  getUser.mockResolvedValue({ data: { user: null } })
}

beforeEach(() => {
  getUser.mockReset()
  maybeSingle.mockReset()
})

describe('hostLocale', () => {
  it('lets an explicit ?lang win over the stored preference', async () => {
    signedIn('hu')
    // A host switching languages must not be argued with by their own account.
    expect(await hostLocale('en')).toBe('en')
  })

  it('falls back to the account when no ?lang is present', async () => {
    signedIn('en')
    // The bookmark case, and the whole point of the column.
    expect(await hostLocale()).toBe('en')
    expect(await hostLocale(undefined)).toBe('en')
  })

  it('ignores a ?lang that is not a locale we serve', async () => {
    signedIn('en')
    // It lands in a URL anyone can type, so it must not be echoed back.
    for (const junk of ['klingon', '', 'EN', 'hu-HU', '../hu']) {
      expect(await hostLocale(junk)).toBe('en')
    }
  })

  it('falls back to the site default for a signed-out visitor', async () => {
    signedOut()
    // `/host/login` renders before there is an account to ask.
    expect(await hostLocale()).toBe('hu')
  })

  it('still honours ?lang when signed out', async () => {
    signedOut()
    expect(await hostLocale('en')).toBe('en')
  })
})

describe('getAccountLocale when the read fails', () => {
  it('falls back rather than throwing', async () => {
    // The case that prompted this: shipping the code before its migration
    // makes every read a `42703 undefined_column`. A *display preference*
    // must not be able to take the host's console to an error boundary — the
    // worst a wrong answer can do is render the other language.
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    maybeSingle.mockResolvedValue({
      data: null,
      error: {
        code: '42703',
        message: 'column profiles.locale does not exist',
      },
    })

    await expect(getAccountLocale()).resolves.toBeNull()
    await expect(hostLocale()).resolves.toBe('hu')
    // An explicit choice still works while the column is missing.
    await expect(hostLocale('en')).resolves.toBe('en')
  })
})

describe('getAccountLocale', () => {
  it('is null when nobody is signed in', async () => {
    signedOut()
    expect(await getAccountLocale()).toBeNull()
  })

  it('reads a stored locale', async () => {
    signedIn('en')
    expect(await getAccountLocale()).toBe('en')
  })

  it('reads an unexpected stored value as the default rather than crashing', async () => {
    // The column is a check-constrained `text`. A row written by a future
    // build with a locale this one does not serve should render the default,
    // not take the page to an error boundary.
    signedIn('de')
    expect(await getAccountLocale()).toBe('hu')
  })
})
