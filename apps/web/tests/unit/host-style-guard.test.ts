import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..')

const SCOPE = [
  'app/(product)/host',
  'app/(product)/auth',
  'components/host',
  'components/event/lightbox.tsx',
  'components/ui/back-link.tsx',
]

/** The switch is shared and has a host tone. Only the focus check reads it:
 *  its default tone wears the old lilac track (`bg-accent`) on purpose, which
 *  is not a host screen's to ban. */
const FOCUS_SCOPE = ['components/ui/switch.tsx']

const BANNED = [
  'outline-accent',
  'font-display',
  'font-mono',
  'glass',
  'paper',
  'text-accent',
  'bg-accent',
  'border-accent',
  'ring-accent',
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

/** A control's own tag, from `<` to the `>` that closes it, skipping any `>`
 *  inside `{…}` (an arrow function, a comparison). Not a JSX parser: it only
 *  has to find where each opening tag ends. */
function openingTags(code: string): string[] {
  const tags: string[] = []
  const start = /<(button|a|Link|motion\.button|input|select|textarea)\b/g
  for (let m = start.exec(code); m; m = start.exec(code)) {
    let depth = 0
    let i = m.index + m[0].length
    for (; i < code.length; i++) {
      const c = code[i]
      if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0) break
    }
    tags.push(code.slice(m.index, i + 1))
  }
  return tags
}

/** What gives a control the white focus mark: a HOST_* class (each carries
 *  HOST_FOCUS or a white ring), its own white focus-visible style, or a
 *  `className` passed through from a caller. */
const WHITE_FOCUS =
  /HOST_[A-Z_]+|\bhostFocus\b|focus-visible:|has-\[:focus-visible\]|className=\{className\}/

/** Not reachable by keyboard, so it has no focus to mark. */
const UNFOCUSABLE = /tabIndex=\{-1\}|type="hidden"|\shidden(\s|\/|>)|sr-only/

/** Controls that would fall back to the global lilac `:focus-visible`
 *  outline, which host screens must not wear. */
export function unmarkedControls(source: string): string[] {
  // Only comments that open a line or a JSX expression: `stripComments` would
  // also eat `accept="image/*"` up to the next `*/`.
  const code = source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\*[\s\S]*?\*\//gm, '')
    .replace(/^\s*\/\/.*$/gm, '')
  // A local class constant that carries the mark, such as `danger`, marks
  // every control that wears it.
  const marked = [
    ...code.matchAll(/const (\w+)\s*=\s*`[^`]*\$\{HOST_FOCUS\}[^`]*`/g),
  ].map((m) => m[1])
  const wears = (tag: string) =>
    marked.some((name) => new RegExp(`\\$?\\{${name}\\}`).test(tag))
  return openingTags(code).filter(
    (tag) => !UNFOCUSABLE.test(tag) && !WHITE_FOCUS.test(tag) && !wears(tag),
  )
}

const files = SCOPE.flatMap((p) => walk(join(ROOT, p))).map((f) =>
  relative(ROOT, f),
)

describe('host style guard', () => {
  it('finds files to guard', () => {
    expect(files.length).toBeGreaterThan(10)
  })

  it('no host file uses the old look', () => {
    const bad = files
      .map((f) => [f, offences(readFileSync(join(ROOT, f), 'utf8'))] as const)
      .filter(([, o]) => o.length > 0)
    expect(bad).toEqual([])
  })

  it('every host control wears the white focus mark', () => {
    const bad = [...files, ...FOCUS_SCOPE]
      .map(
        (f) =>
          [f, unmarkedControls(readFileSync(join(ROOT, f), 'utf8'))] as const,
      )
      .filter(([, tags]) => tags.length > 0)
    expect(bad).toEqual([])
  })

  it('control matcher sees through arrows and skips the unfocusable', () => {
    expect(
      unmarkedControls('<button onClick={() => a > b} className="h-11" />'),
    ).toHaveLength(1)
    expect(
      unmarkedControls('<button className={`h-11 ${HOST_FOCUS}`} />'),
    ).toEqual([])
    expect(
      unmarkedControls('<button tabIndex={-1} className="inset-0" />'),
    ).toEqual([])
    expect(unmarkedControls('/** <input type="time"> */')).toEqual([])
    expect(
      unmarkedControls(
        'const d = `h-12 ${HOST_FOCUS}`\n<button accept="image/*" className={d} />',
      ),
    ).toEqual([])
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
