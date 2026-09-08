/**
 * The database suite may only point at a local stack.
 *
 *     pnpm test
 *
 * Tested here, in the offline suite, rather than in `tests/db` — the guard's
 * whole job is to stop that suite from connecting to the wrong thing, so
 * proving it must not require connecting to anything.
 *
 * The stakes are not hypothetical. The db suite writes throwaway users, events,
 * participants and photos and cleans them up in a `finally`, which an interrupt
 * or a thrown fixture skips. The linked project holds real weddings, and until
 * this guard existed pointing the suite at it was the documented workflow.
 */
import { describe, expect, it } from 'vitest'

import { assertLocalSupabase, isLocalSupabaseUrl } from '../db/local-only'

const local = [
  'http://127.0.0.1:54321',
  'http://localhost:54321',
  'http://[::1]:54321',
  'http://0.0.0.0:54321',
  // The CLI's default port is not part of the contract.
  'http://127.0.0.1:9999',
]

const remote = [
  // The shape `.env.local` holds, which is the accident being guarded against.
  'https://abcdefghijklmnop.supabase.co',
  'https://abcdefghijklmnop.supabase.co/',
  'https://db.abcdefghijklmnop.supabase.co',
  // Hostnames that merely *look* local. A DNS name an attacker or a typo
  // controls is not a loopback address.
  'https://localhost.example.com',
  'https://127.0.0.1.example.com',
  'https://notlocalhost',
  // Not a URL at all.
  '',
  'supabase',
]

describe('the database suite target', () => {
  it.each(local)('accepts the local stack: %s', (url) => {
    expect(isLocalSupabaseUrl(url)).toBe(true)
    expect(() => assertLocalSupabase(url)).not.toThrow()
  })

  it.each(remote)('refuses anything else: %s', (url) => {
    expect(isLocalSupabaseUrl(url)).toBe(false)
    expect(() => assertLocalSupabase(url)).toThrow(/Refusing to run/)
  })

  it('names the recovery in the message, not just the problem', () => {
    // Whoever trips this is mid-task and about to look for a way round it.
    expect(() => assertLocalSupabase('https://x.supabase.co')).toThrow(
      /pnpm supabase start/,
    )
  })
})
