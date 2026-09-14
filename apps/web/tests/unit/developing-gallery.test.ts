import { describe, expect, it } from 'vitest'

import { developingWash } from '@/lib/developing-wash'
import { developingTileLabel, moreDevelopingLabel } from '@/lib/event-copy'

const HOUR = 60 * 60 * 1000

describe('developingWash', () => {
  it('draws the same tile for the same seed', () => {
    // Server and client render it, and a refresh must not reshuffle the wall.
    expect(developingWash(123456789)).toBe(developingWash(123456789))
  })

  it('draws different tiles for different seeds', () => {
    const washes = new Set(
      [1, 2, 3, 99, -7, 2 ** 31 - 1, -(2 ** 31)].map(developingWash),
    )
    expect(washes.size).toBe(7)
  })

  it('uses only palette tokens, never a colour of its own', () => {
    for (const seed of [0, 42, -42, 2 ** 31 - 1, -(2 ** 31)]) {
      const wash = developingWash(seed)
      expect(wash).not.toMatch(/#[0-9a-f]{3,8}\b|rgb|hsl/i)
      expect(wash).toContain('var(--film)')
    }
  })

  it('never lays the same light twice on one tile', () => {
    for (let seed = -5000; seed < 5000; seed += 37) {
      const lights = [
        ...developingWash(seed).matchAll(/var\((--accent[\w-]*)\)/g),
      ]
      expect(lights).toHaveLength(2)
      expect(lights[0][1]).not.toBe(lights[1][1])
    }
  })
})

describe('developingTileLabel', () => {
  const now = new Date('2026-09-14T18:00:00Z')

  it('counts down in the short spelling', () => {
    const revealAt = new Date(now.getTime() + 29 * HOUR)
    expect(developingTileLabel(revealAt, now)).toBe('Előhívás: 1N 5Ó')
    expect(developingTileLabel(revealAt, now, 'en')).toBe('Reveals in 1D 5H')
  })

  it('stops counting once the instant has passed', () => {
    // The page refreshes on its own; until it lands, `0P` would be a lie.
    const revealAt = new Date(now.getTime() - 1000)
    expect(developingTileLabel(revealAt, now)).toBe('Most hívódik elő')
    expect(developingTileLabel(revealAt, now, 'en')).toBe('Developing now')
  })
})

describe('moreDevelopingLabel', () => {
  it('names what is past the wall', () => {
    expect(moreDevelopingLabel(12)).toBe('+12 további')
    expect(moreDevelopingLabel(12, 'en')).toBe('+12 more')
  })
})
