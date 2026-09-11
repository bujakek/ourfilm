import { describe, expect, it } from 'vitest'

import {
  hostDisplayName,
  hostDisplayNameProblem,
  hostInitials,
} from '@/lib/host-name'

describe('host profile names', () => {
  it('prefers the saved name and falls back without publishing an email', () => {
    expect(hostDisplayName('anna@example.com', 'Anna Kovács')).toBe(
      'Anna Kovács',
    )
    expect(hostDisplayName('anna@example.com', null)).toBe('anna')
    expect(hostDisplayName(null, null)).toBe('Host')
  })

  it('validates the same 2–40 character range as the database', () => {
    expect(hostDisplayNameProblem('')).toBe('required')
    expect(hostDisplayNameProblem('A')).toBe('too_short')
    expect(hostDisplayNameProblem('Réka N.')).toBeNull()
    expect(hostDisplayNameProblem('x'.repeat(41))).toBe('too_long')
  })

  it('builds stable two-letter initials', () => {
    expect(hostInitials('László Buják')).toBe('LB')
    expect(hostInitials('Anna')).toBe('AA')
    expect(hostInitials('  ')).toBe('OF')
  })
})
