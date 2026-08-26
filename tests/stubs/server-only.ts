/**
 * Stands in for the `server-only` package under vitest.
 *
 * The real package is a tripwire: its `default` export throws, and only the
 * `react-server` condition resolves to a no-op. Vitest resolves the default,
 * so importing anything in `lib/content/` would blow up before a single
 * assertion ran — and the alternative, re-implementing the content loader
 * inside the test, would be testing a copy of the thing that ships rather than
 * the thing itself.
 */
export {}
