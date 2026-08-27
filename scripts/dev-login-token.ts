/**
 * Development helper: mint a one-shot magic-link token for a host account.
 *
 *   node --env-file=.env.local --experimental-strip-types scripts/dev-login-token.ts
 *
 * Exists so a headless browser can sign in and screenshot `/admin` without a
 * human opening an inbox. Supabase's `generateLink` mints the token without
 * sending mail, so nothing reaches the real address.
 *
 * The token is written to `.dev-login-token` (gitignored) rather than stdout:
 * it is a bearer credential for the account named below, and a value printed
 * to a terminal ends up in scrollback, transcripts and CI logs.
 *
 * Single-use and short-lived, but treat it as a password until it is redeemed.
 * Needs the service role key — minting a session for another account is
 * exactly the privilege that key exists to hold.
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'
import path from 'node:path'

import type { Database } from '../lib/supabase/database.types.ts'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Run with: node --env-file=.env.local … (see the seed script in package.json).',
  )
}

const supabase = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false },
})

// No address is hardcoded, for the same reason `seed.ts` hardcodes none: a
// personal email does not belong in a committed script. Set DEV_LOGIN_EMAIL,
// or rely on the fallback when the project has exactly one account.
const { data: userList, error: userError } =
  await supabase.auth.admin.listUsers()
if (userError) throw userError

const wanted = process.env.DEV_LOGIN_EMAIL
const host = wanted
  ? userList.users.find((u) => u.email === wanted)
  : userList.users.length === 1
    ? userList.users[0]
    : undefined

if (!host?.email) {
  const known = userList.users.map((u) => u.email).join(', ') || 'none'
  throw new Error(
    wanted
      ? `No auth user for DEV_LOGIN_EMAIL=${wanted}. Known accounts: ${known}`
      : `Set DEV_LOGIN_EMAIL to pick an account — this project has ` +
          `${userList.users.length} accounts: ${known}`,
  )
}

const { data, error } = await supabase.auth.admin.generateLink({
  type: 'magiclink',
  email: host.email,
})
if (error) throw error

const out = path.join(process.cwd(), '.dev-login-token')
writeFileSync(out, data.properties.hashed_token, {
  encoding: 'utf8',
  mode: 0o600,
})

console.log(`Magic-link token for ${host.email} written to ${out}`)
console.log(
  `Redeem at http://localhost:3000/auth/callback?token_hash=$(cat .dev-login-token)&type=magiclink`,
)
