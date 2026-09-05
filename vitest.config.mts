import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Two suites, deliberately separated by which ones can hurt you.
 *
 * `pnpm test` is pure logic: no network, no database, no browser. It is part of
 * `pnpm verify`, so it has to stay fast and has to pass on a laptop with no
 * `.env.local` at all.
 *
 * `pnpm test:db` mutates a database — it creates throwaway auth users, events
 * and participants and cleans them up afterwards — so it runs only against a
 * **local** Supabase stack. `scripts/test-db.mjs` picks the target and
 * `tests/db/local-only.ts` refuses anything that is not loopback. The
 * properties worth testing here (a row lock holding under concurrent HTTP
 * requests, an RLS policy refusing a real anon key) need a real Postgres and a
 * real PostgREST; the local stack is both.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      // See tests/stubs/server-only.ts — without this the content layer cannot
      // be imported into a test at all.
      'server-only': fileURLToPath(
        new URL('./tests/stubs/server-only.ts', import.meta.url),
      ),
      // See tests/stubs/client-only.ts. The browser-side upload store carries
      // the marker for the build's benefit and still has to be testable.
      'client-only': fileURLToPath(
        new URL('./tests/stubs/client-only.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include:
      process.env.OURFILM_TEST_SUITE === 'db'
        ? ['tests/db/**/*.test.ts']
        : ['tests/unit/**/*.test.ts'],
    // The database suite shares one Postgres. Files running in parallel
    // would interleave their fixtures, and a concurrency test that is itself
    // racing an unrelated file proves nothing.
    ...(process.env.OURFILM_TEST_SUITE === 'db'
      ? { fileParallelism: false, testTimeout: 60_000, hookTimeout: 60_000 }
      : {}),
  },
})
