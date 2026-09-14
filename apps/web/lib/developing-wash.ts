/**
 * The colour inside a tile that has not developed yet.
 *
 * Nothing about the photo reaches the page before the reveal, so the tile has
 * nothing of its own to show — only a seed the database hashed from its id.
 * This turns that seed into two soft washes of the palette's own light over the
 * film ground, so a wall of them reads as a roll of different exposures rather
 * than a grid of identical placeholders.
 *
 * Only tokens, never a colour of its own: every value is a `var()` from
 * `globals.css`, mixed toward transparent. Pure, so the server and the client
 * draw the same tile and a refresh does not reshuffle the wall.
 */

const LIGHTS = ['--accent-blue', '--accent', '--accent-silver'] as const

export function developingWash(seed: number): string {
  // Unsigned, so a negative int4 from Postgres spreads like any other.
  const u = seed >>> 0
  const x = 20 + (u % 61)
  const y = 15 + ((u >>> 8) % 51)
  const first = (u >>> 16) % LIGHTS.length
  // One or two steps round the palette: never the same light twice.
  const second = (first + 1 + ((u >>> 20) % 2)) % LIGHTS.length
  const strength = 38 + ((u >>> 24) % 25)

  return [
    `radial-gradient(circle at ${x}% ${y}%, color-mix(in oklab, var(${LIGHTS[first]}) ${strength}%, transparent) 0%, transparent 58%)`,
    `radial-gradient(circle at ${100 - x}% ${100 - Math.round(y / 2)}%, color-mix(in oklab, var(${LIGHTS[second]}) ${strength - 18}%, transparent) 0%, transparent 62%)`,
    'linear-gradient(160deg, var(--background-secondary), var(--film))',
  ].join(', ')
}
