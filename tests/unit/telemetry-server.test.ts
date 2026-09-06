import { describe, expect, it } from 'vitest'

import {
  safeServerErrorName,
  safeServerRoute,
  safeServerValue,
} from '@/lib/telemetry-server'

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

  it('accepts a uuid in an id field and nothing else', () => {
    // The whole point of these two fields: they hold a random identifier the
    // database or the browser minted, so anything shaped differently is a
    // value that arrived by mistake — a slug, an event name, an address.
    const id = '9f8b1c62-4f2a-4d70-9c5e-2a1b3c4d5e6f'
    expect(safeServerValue('event_id', id)).toBe(id)
    expect(safeServerValue('creation_key', id)).toBe(id)
    expect(safeServerValue('event_id', 'k3f9x7ab2m')).toBeNull()
    expect(safeServerValue('event_id', 'Anna és Bence esküvője')).toBeNull()
    expect(safeServerValue('creation_key', 'guest@example.com')).toBeNull()
  })

  it('reduces every other property to a bounded scalar', () => {
    // A string is a token, never prose: a name or an address that reached one
    // of these fields cannot survive the substitution intact.
    expect(safeServerValue('reason', 'already_unlimited')).toBe(
      'already_unlimited',
    )
    expect(safeServerValue('setting', 'Anna Kovács')).toBe('Anna_Kov_cs')
    expect(safeServerValue('note', 'x'.repeat(200))).toHaveLength(80)

    expect(safeServerValue('missing_count', 0)).toBe(0)
    expect(safeServerValue('amount_minor', 1_290_000)).toBe(1_290_000)
    expect(safeServerValue('guests_can_view', false)).toBe(false)

    // Always a computation that went wrong upstream, and `NaN` serialises to
    // `null` in transit anyway — so it arrives as one honestly.
    expect(safeServerValue('age_hours', Number.NaN)).toBeNull()
    expect(safeServerValue('elapsed_ms', Number.POSITIVE_INFINITY)).toBeNull()
    expect(safeServerValue('currency', undefined)).toBeNull()
    expect(safeServerValue('currency', null)).toBeNull()
  })
})
