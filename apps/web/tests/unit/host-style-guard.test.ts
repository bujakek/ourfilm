import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..')

const SCOPE = [
  'app/(product)/host',
  'app/(product)/auth',
  'components/host',
  'components/event/lightbox.tsx',
]

const BANNED = [
  'font-display',
  'font-mono',
  'glass',
  'paper',
  'text-accent',
  'bg-accent',
  'border-accent',
  'ring-accent',
]

/** Files still on the old look. Each task removes its own; Task 8 empties it. */
export const PENDING: string[] = [
  'app/(product)/host/account/page.tsx',
  'app/(product)/host/login/login-form.tsx',
  'app/(product)/host/page.tsx',
  'components/host/account-name-form.tsx',
  'components/host/event-list.tsx',
  'components/event/lightbox.tsx',
]

function walk(path: string): string[] {
  if (statSync(path).isFile()) return path.endsWith('.tsx') ? [path] : []
  return readdirSync(path).flatMap((name) => walk(join(path, name)))
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
}

const UTILITY_PREFIX =
  '(?:(?:bg|text|border|ring|from|to|via|fill|stroke|outline|shadow|divide)-)?'

/** Banned tokens as class-name words, with or without a utility prefix and a
 *  variant: `glass-overlay`, `bg-accent/70`, `bg-paper`, `text-paper-foreground`
 *  and `hover:border-accent` count; `glassy` and `paperwork` do not. */
export function offences(source: string): string[] {
  const code = stripComments(source)
  return BANNED.filter((token) =>
    new RegExp(
      `(^|[^\\w-])(?:[\\w:\\[\\]-]*:)?${UTILITY_PREFIX}${token}(?![\\w])`,
    ).test(code),
  )
}

const files = SCOPE.flatMap((p) => walk(join(ROOT, p))).map((f) =>
  relative(ROOT, f),
)

describe('host style guard', () => {
  it('finds files to guard', () => {
    expect(files.length).toBeGreaterThan(10)
  })

  it('no file outside PENDING uses the old look', () => {
    const bad = files
      .filter((f) => !PENDING.includes(f))
      .map((f) => [f, offences(readFileSync(join(ROOT, f), 'utf8'))] as const)
      .filter(([, o]) => o.length > 0)
    expect(bad).toEqual([])
  })

  it('every PENDING entry still offends', () => {
    const stale = PENDING.filter(
      (f) =>
        !files.includes(f) ||
        offences(readFileSync(join(ROOT, f), 'utf8')).length === 0,
    )
    expect(stale).toEqual([])
  })

  it('matcher catches prefixed paper and glass, ignores prose', () => {
    expect(offences('<i className="bg-paper p-2" />')).toEqual(['paper'])
    expect(offences('<i className="text-paper-foreground" />')).toEqual([
      'paper',
    ])
    expect(offences('<i className="hover:border-paper" />')).toEqual(['paper'])
    expect(offences('<i className="glass-overlay" />')).toEqual(['glass'])
    expect(offences("<p>{'Paper tickets, glassy and paperwork'}</p>")).toEqual(
      [],
    )
  })
})
