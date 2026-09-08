import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import type { Database } from './database.types'
import { publicSupabaseEnv } from './env'

/**
 * Supabase client for the browser: admin sign-in and any gallery interactivity
 * that should see the host session if one exists.
 *
 * Guest *writes* must not use this. `createBrowserClient` reads the auth
 * cookies, so a host who scanned the table QR in the same Safari that is
 * signed into `/host` would upload as `authenticated`. The guest insert
 * policies used to be `to anon` only, and even after they accept both roles,
 * an expired leftover session would still 401 a wedding guest's upload.
 */
export function createClient() {
  const { url, anonKey } = publicSupabaseEnv()
  return createBrowserClient<Database>(url, anonKey)
}

/**
 * Guest uploads. Always the anon key, never the host session: no cookie
 * storage, no token refresh, no URL detection. The QR-opened page and the
 * shared-link page then hit Storage as the same role.
 */
export function createGuestClient(customFetch?: typeof globalThis.fetch) {
  const { url, anonKey } = publicSupabaseEnv()
  return createSupabaseClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: customFetch ? { fetch: customFetch } : undefined,
  })
}
