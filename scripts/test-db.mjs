/**
 * Run the database suite against the local Supabase stack, and nothing else.
 *
 * This script exists so `pnpm test:db` has no way to reach the linked project.
 * It used to be `node --env-file=.env.local vitest`, and `.env.local` is the
 * production database — the one with real weddings in it. The suite writes
 * throwaway users, events, participants and photos and tidies up in a
 * `finally`, which an interrupt or a thrown fixture skips.
 *
 * Credentials come from `supabase status`, so they always match the stack that
 * is actually running and there is nothing to keep in step by hand. If the
 * stack is down this exits with instructions rather than falling back to
 * anything — a fallback is exactly the bug.
 *
 * `tests/db/local-only.ts` refuses a non-loopback URL as well. Two layers on
 * purpose: this one picks the right target, that one catches anybody who runs
 * vitest directly.
 */
import { spawnSync } from 'node:child_process'

const status = spawnSync(
  'supabase',
  ['status', '-o', 'env', '--workdir', process.cwd()],
  { encoding: 'utf8' },
)

if (status.status !== 0) {
  console.error(
    'The local Supabase stack is not running.\n\n' +
      '  pnpm supabase start     # once per machine\n' +
      '  pnpm supabase db reset  # apply migrations locally\n' +
      '  pnpm test:db\n\n' +
      'This suite never runs against the linked project.',
  )
  process.exit(1)
}

/** `-o env` emits KEY="value" per line. */
function read(name) {
  const match = status.stdout.match(new RegExp(`^${name}="?([^"\\n]*)"?$`, 'm'))
  return match?.[1]
}

const url = read('API_URL')
const anonKey = read('ANON_KEY')
const serviceKey = read('SERVICE_ROLE_KEY')

if (!url || !anonKey || !serviceKey) {
  console.error(
    'Could not read API_URL, ANON_KEY and SERVICE_ROLE_KEY from ' +
      '`supabase status -o env`. The CLI may have renamed them; the raw ' +
      'output follows so this is a legible failure rather than a silent one.\n',
  )
  console.error(status.stdout.replace(/=.{8}\S*/g, '=<redacted>'))
  process.exit(1)
}

const result = spawnSync(
  process.execPath,
  ['node_modules/vitest/vitest.mjs', 'run', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      OURFILM_TEST_SUITE: 'db',
      // Explicit, and last, so nothing inherited from a shell can redirect the
      // suite at another database.
      NEXT_PUBLIC_SUPABASE_URL: url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
      SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    },
  },
)

process.exit(result.status ?? 1)
