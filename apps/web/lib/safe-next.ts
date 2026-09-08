/**
 * Confine a `next` parameter to this site.
 *
 * Without this the callback forwards wherever it is told: `new URL(next,
 * origin)` lets an absolute URL override the base entirely, so `?next=https://
 * evil.example` would land a host on someone else's page moments after a real
 * sign-in on a real ourfilm.app link — which is exactly the moment they are
 * least suspicious of what they are looking at.
 *
 * Resolved through the URL parser and compared by origin rather than
 * prefix-matched as a string, because the parser is what ultimately decides
 * where the redirect goes and it is full of traps a hand-rolled check misses.
 * It strips tabs and newlines *before* parsing, so `/\t/evil.example` is
 * `//evil.example` — protocol-relative and off-site — to everything that
 * matters, while `startsWith('/')` waves it through. Backslashes are folded to
 * slashes for the same reason. Delegating removes the need to predict any of
 * that.
 */
export function safeNext(raw: string | null, origin: string): string {
  const fallback = '/host'
  if (!raw) return fallback

  try {
    const target = new URL(raw, origin)
    if (target.origin !== origin) return fallback
    // Rebuilt from the parsed parts, so what gets redirected to is what was
    // actually checked.
    return target.pathname + target.search + target.hash
  } catch {
    return fallback
  }
}
