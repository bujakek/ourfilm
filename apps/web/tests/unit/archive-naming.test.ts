import { describe, expect, it } from 'vitest'

import {
  archiveEntryNames,
  sortForArchive,
  type ArchivePhoto,
} from '@/lib/archive-naming'

import cases from './fixtures/archive-naming.json'

/**
 * Golden fixture for the album archive's naming rules.
 *
 * The expected names in `fixtures/archive-naming.json` were written out by
 * hand from the rules, not pasted from a run — so a change in behaviour shows
 * up as a red case rather than as a silently regenerated fixture. The rules
 * used to live inline in the export route; they moved out so that a second
 * runtime (the planned export worker, the browser download) can produce
 * byte-identical archives. This file is what "identical" is measured against.
 *
 * One case deliberately pins an ugly output — a trailing hyphen after a name
 * ending in punctuation — because that is what the route has always produced.
 * Tidying it is a legitimate change; it is just not one that may happen by
 * accident.
 */

type Case = {
  name: string
  zone: string
  input: ArchivePhoto[]
  expected: string[]
}

describe('archive naming', () => {
  for (const c of cases as Case[]) {
    it(c.name, () => {
      const names = archiveEntryNames(c.input, c.zone).map((e) => e.name)
      expect(names).toEqual(c.expected)
    })
  }

  it('sorts without mutating its input', () => {
    const input = (cases as Case[]).at(-1)!.input
    const before = input.map((p) => p.id)
    sortForArchive(input)
    expect(input.map((p) => p.id)).toEqual(before)
  })
})
