/**
 * Reads the public Supabase credentials, failing with something actionable.
 *
 * Without the check you get an opaque `Invalid URL` from deep inside the SDK,
 * which is a miserable thing to debug — and it is a likely mistake here,
 * because `.env.local` is maintained by hand on this project and the Supabase
 * integration also ships bare `SUPABASE_URL` / `SUPABASE_ANON_KEY` that look
 * right but are invisible to the browser.
 *
 * Deliberately a function rather than module-level constants: a throw at import
 * time would take down the build, not just the request that needed it.
 */
export function publicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    const missing = [
      !url && 'NEXT_PUBLIC_SUPABASE_URL',
      !anonKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ]
      .filter(Boolean)
      .join(' and ')

    throw new Error(
      `Missing ${missing}. Note the NEXT_PUBLIC_ prefix — the bare ` +
        `SUPABASE_URL / SUPABASE_ANON_KEY the integration provides are not ` +
        `exposed to the browser. See the Local env section of CLAUDE.md.`,
    )
  }

  return { url, anonKey }
}
