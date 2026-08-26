import 'server-only'

import { createClient } from '@supabase/supabase-js'

import { publicSupabaseEnv } from '@/lib/supabase/env'

import type { LegalDatabase } from './database.types'

/**
 * A service-role client for the compliance tables.
 *
 * Separate from `createAdminClient()` only because those tables are not in the
 * generated `Database` type yet — see the header of `database.types.ts`. It
 * carries exactly the same key and exactly the same warning: it bypasses RLS
 * completely, and every one of these tables has RLS on with no policies, so
 * this is the only thing that can reach them at all. That is deliberate — a
 * withdrawal request and a content report both hold personal data that must
 * never be readable from a browser.
 */
export function createLegalClient() {
  const { url } = publicSupabaseEnv()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY. The legal acceptance, withdrawal ' +
        'and report tables are service-role only by design — RLS is on and ' +
        'no policy exists — so nothing can reach them without it.',
    )
  }

  return createClient<LegalDatabase>(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
