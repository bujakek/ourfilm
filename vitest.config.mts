import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Two suites, deliberately separated by which ones can hurt you.
 *
 * `pnpm test` is pure logic: no network, no database, no browser. It is part of
 * `pnpm verify`, so it has to stay fast and has to pass on a laptop with no
 * `.env.local` at all.
 *
 * `pnpm test:db` talks to the **linked remote project** and mutates it — it
 * creates throwaway auth users, events and participants and cleans them up
 * afterwards. That is the same bargain the Python suites it replaces made, and
 * it is unavoidable: the properties worth testing here (a row lock holding
 * under concurrent HTTP requests, an RLS policy refusing a real anon key) do
 * not exist anywhere except a real Postgres.
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
    },
  },
  test: {
    environment: 'node',
    include:
      process.env.OURFILM_TEST_SUITE === 'db'
        ? ['tests/db/**/*.test.ts']
        : ['tests/unit/**/*.test.ts'],
    // The database suite shares one remote Postgres. Files running in parallel
    // would interleave their fixtures, and a concurrency test that is itself
    // racing an unrelated file proves nothing.
    ...(process.env.OURFILM_TEST_SUITE === 'db'
      ? { fileParallelism: false, testTimeout: 60_000, hookTimeout: 60_000 }
      : {}),
  },
})
