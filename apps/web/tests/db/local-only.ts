/**
 * The database suite may only ever point at a local stack.
 *
 * This is a guard rather than a convention because the difference between the
 * two targets is a production incident. The suite creates throwaway auth users,
 * events, participants and photos, and cleans them up in a `finally` — which is
 * not a guarantee. An interrupted run, a thrown fixture, a killed terminal, and
 * the rows stay. Against the linked project that means writing junk into a
 * database holding real weddings, and `truncate`-shaped helpers in a suite that
 * believes it owns the schema are one edit away from doing much worse.
 *
 * The suite reads `NEXT_PUBLIC_SUPABASE_URL`, and `.env.local` — the file every
 * other command in this project loads — points at the linked project. So the
 * accident is not exotic: it is one `--env-file` away, and it used to be the
 * documented way to run this.
 *
 * Hence: refuse anything that is not loopback, before a client is constructed
 * and before a single request can leave the machine.
 */

/** Hosts the Supabase CLI binds its local stack to. */
const LOCAL_HOSTS = new Set([
  '127.0.0.1',
  'localhost',
  '::1',
  '[::1]',
  '0.0.0.0',
])

export function isLocalSupabaseUrl(url: string): boolean {
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    return false
  }
  // `new URL` strips the brackets from an IPv6 literal; both spellings are
  // listed so neither form has to be normalised here.
  return LOCAL_HOSTS.has(host)
}

/**
 * Abort unless `url` is a local stack. Throws — never returns false — so a
 * caller cannot forget to check the result.
 */
export function assertLocalSupabase(url: string): void {
  if (isLocalSupabaseUrl(url)) return

  throw new Error(
    `Refusing to run the database suite against ${url}.\n\n` +
      'This suite writes to the database it is pointed at, and cleanup is ' +
      'best-effort. It may only run against a local Supabase stack.\n\n' +
      '  pnpm supabase start     # once per machine\n' +
      '  pnpm supabase db reset  # apply migrations locally\n' +
      '  pnpm test:db\n\n' +
      '`pnpm test:db` supplies the local credentials itself. If you are seeing ' +
      'this, something handed it .env.local, which points at the linked ' +
      'project — the one with real customers in it.',
  )
}
