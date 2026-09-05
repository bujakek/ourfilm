/**
 * Stands in for the `client-only` package under vitest.
 *
 * Unlike `server-only`, the real package is a genuine no-op outside a React
 * Server Component, so importing it in a test happens to work today. It is
 * aliased anyway for the same reason `server-only` is: the marker is there to
 * fail a *build* that pulls browser-only code onto the server, and a test suite
 * that depends on the marker's runtime behaviour is depending on an accident.
 *
 * `lib/upload-store.ts` is what needs this. Its marker does real work — reaching
 * `indexedDB` on the server is a crash, not a warning — and it still has to be
 * importable from `tests/unit/upload-store.test.ts`.
 */
export {}
