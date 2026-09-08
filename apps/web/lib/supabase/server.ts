// Makes importing this from a Client Component a build error rather than a
// subtle runtime leak. This module reads auth cookies; it has no business in a
// browser bundle.
import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import type { Database } from './database.types'
import { publicSupabaseEnv } from './env'

/**
 * Supabase client for Server Components, Route Handlers and Server Actions.
 *
 * Uses the anon key, not the service role: this client carries the caller's
 * session, so RLS still applies and a signed-in host sees exactly their own
 * events. The service role key belongs only in the ZIP export, which needs to
 * bypass RLS on purpose and re-checks ownership in code.
 *
 * `cookies()` is async in Next 16.
 */
export async function createClient() {
  const { url, anonKey } = publicSupabaseEnv()
  const cookieStore = await cookies()

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        } catch {
          // Called during a Server Component render, where cookies are
          // read-only. Middleware refreshes the session instead, so this is
          // expected rather than an error worth surfacing.
        }
      },
    },
  })
}
