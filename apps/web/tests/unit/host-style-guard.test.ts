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
  'app/(product)/host/events/[slug]/checkout/page.tsx',
  'app/(product)/host/events/[slug]/settings/page.tsx',
  'app/(product)/host/events/new/step-guests.tsx',
  'app/(product)/host/events/new/step-name.tsx',
  'app/(product)/host/login/login-form.tsx',
  'app/(product)/host/page.tsx',
  'app/(product)/auth/event-complete/complete-creation.tsx',
  'components/host/account-name-form.tsx',
  'components/host/billing-card.tsx',
  'components/host/billing-country-field.tsx',
  'components/host/capture-end-card.tsx',
  'components/host/checkout-success.tsx',
  'components/host/event-end-fields.tsx',
  'components/host/event-list.tsx',
  'components/host/event-name-card.tsx',
  'components/host/guests-toggle.tsx',
  'components/host/month-calendar.tsx',
  'components/host/onboarding/onboarding-shell.tsx',
  'components/host/onboarding/reveal-preview.tsx',
  'components/host/onboarding/save-event-screen.tsx',
  'components/host/post-event-uploads-card.tsx',
  'components/host/reveal-card.tsx',
  'components/host/reveal-selector.tsx',
  'components/host/shots-card.tsx',
  'components/host/shots-selector.tsx',
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
