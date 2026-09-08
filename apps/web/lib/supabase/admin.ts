import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import type { Database } from './database.types'
import { publicSupabaseEnv } from './env'

/**
 * The service-role client. It bypasses RLS completely — read every call made
 * with it as though the policies did not exist, because for this client they
 * do not.
 *
 * Two kinds of caller, and both are things no user session can stand in for.
 *
 * The Stripe webhook: Stripe is the caller, not the host, and it has to write
 * `purchases.status = 'paid'`, which no policy grants to anyone. That gap is
 * deliberate — a host who could write that column could hand themselves a paid
 * album for free.
 *
 * The guest capture path (`lib/participants.ts`, `lib/capture.ts`): guests are
 * anonymous, so there is no session to scope them by, and the thing that must
 * be protected is the shot limit. The four write RPCs are granted to
 * `service_role` alone precisely so the only way to reach them is from a server
 * action holding the httpOnly session cookie. Granting them to `anon` would
 * make the token hash sufficient on its own, and a hash is a value that can be
 * observed.
 *
 * Deliberately not used by the ZIP export or the delete path, which both look
 * like candidates. Those run on the host's own session, and
 * `getOwnedEventBySlug` returning null is their ownership check — keeping the
 * service key out of anything that streams user data is worth the sentence.
 *
 * A function rather than a module constant, matching `publicSupabaseEnv`: a
 * throw at import time would take down the whole build rather than the one
 * request that needed the key.
 */
export function createAdminClient() {
  const { url } = publicSupabaseEnv()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY. The guest capture path and the ' +
        'Stripe webhook both need it: the shot-limit RPCs and ' +
        'purchases.status are granted to service_role alone, on purpose. ' +
        'Copy it from the Supabase dashboard; see the Local env section of ' +
        'CLAUDE.md.',
    )
  }

  return createSupabaseClient<Database>(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
