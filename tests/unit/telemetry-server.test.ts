import { describe, expect, it } from 'vitest'

import { safeServerErrorName, safeServerRoute } from '@/lib/telemetry-server'

describe('server telemetry privacy boundary', () => {
  it('keeps route templates and masks concrete event links', () => {
    expect(safeServerRoute('/e/private-event?token_hash=secret')).toBe(
      '/e/[slug]',
    )
    expect(
      safeServerRoute('/host/events/private-event/settings?code=secret'),
    ).toBe('/host/events/[slug]/settings')
    expect(safeServerRoute('/host/events/new')).toBe('/host/events/new')
    expect(safeServerRoute('/e/[slug]')).toBe('/e/[slug]')
  })

  it('uses only the error class, never its message', () => {
    expect(safeServerErrorName(new TypeError('email@example.com'))).toBe(
      'TypeError',
    )
    expect(safeServerErrorName({ name: 'Bad Name!' })).toBe('UnknownError')
    expect(safeServerErrorName({ name: 'JohnDoe' })).toBe('UnknownError')
    expect(safeServerErrorName('secret value')).toBe('UnknownError')
  })

  it('names a PostgREST refusal by its code and nothing else', () => {
    // supabase-js returns the error as a plain object with no `name`.
    expect(
      safeServerErrorName({
        message:
          'insert or update on table "purchases" violates foreign key constraint',
        details: 'Key (event_id)=(645c322a) is not present in table "events".',
        hint: null,
        code: '23503',
      }),
    ).toBe('PostgrestError:23503')
    expect(
      safeServerErrorName({
        message: 'FetchError: fetch failed',
        details: '',
        hint: '',
        code: '',
      }),
    ).toBe('PostgrestError')
    expect(
      safeServerErrorName({
        message: 'x',
        details: '',
        hint: '',
        code: 'email@example.com',
      }),
    ).toBe('PostgrestError')
    // An unrelated object that happens to carry a code is still unknown.
    expect(safeServerErrorName({ message: 'x', code: '23503' })).toBe(
      'UnknownError',
    )
  })
})
