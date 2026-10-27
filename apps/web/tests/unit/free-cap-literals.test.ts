import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

import { shotRollList } from '@/lib/camera'

/**
 * The free cap and the roll lengths have one definition each
 * (`FREE_PARTICIPANT_LIMIT`, `SHOT_OPTIONS`). Customer-facing copy that spells
 * them as literals goes stale the day either changes, so source files under
 * app, components and lib may not.
 */
const ROOT = join(__dirname, '..', '..')
const CAP_LITERAL =
  /(\b5\s*(vendég|résztvevő|guests?|people)|up to 5\b|five (guests|participants))/i

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

/** Comments may name the number; only code and copy are checked. */
function withoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/^\s*\/\/.*$/, ''))
    .join('\n')
}

describe('free cap literals', () => {
  it('spells the participant cap nowhere in app, components or lib', () => {
    const hits = ['app', 'components', 'lib'].flatMap((dir) =>
      sources(join(ROOT, dir)).flatMap((file) =>
        withoutComments(readFileSync(file, 'utf8'))
          .split('\n')
          .filter((line) => CAP_LITERAL.test(line))
          .map(
            (line) => `${relative(ROOT, file)}: ${line.trim().slice(0, 80)}`,
          ),
      ),
    )
    expect(hits).toEqual([])
  })

  it('lists the roll lengths from SHOT_OPTIONS in occasions and llms.txt', () => {
    for (const file of ['lib/occasions.ts', 'app/llms.txt/route.ts']) {
      expect(readFileSync(join(ROOT, file), 'utf8')).not.toContain(
        '5, 10, 16, 24',
      )
    }
  })

  it('joins the roll lengths with the locale word', () => {
    expect(shotRollList('or')).toBe('5, 10, 16, 24 or 36')
    expect(shotRollList('vagy')).toBe('5, 10, 16, 24 vagy 36')
  })
})
