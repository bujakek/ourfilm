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
})
