import { findStaleClaims } from '@/lib/content/claims'
import { getAllDocs } from '@/lib/content/docs'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The pivot linter, pointed at the pages it exists for — and at the cases it
 * must **not** fire on, which is the half that decides whether anyone leaves
 * it switched on.
 */
describe('findStaleClaims', () => {
  it('catches a pre-pivot promise about OurFilm', () => {
    expect(
      findStaleClaims('Az OurFilmmel korlátlan fotót tölthettek fel.'),
    ).toHaveLength(1)
    expect(
      findStaleClaims('Az OurFilm 5 fotóig ingyenesen kipróbálható.'),
    ).toHaveLength(1)
    expect(
      findStaleClaims('Az OurFilm egy egyszerű feltöltőalbum esküvőre.'),
    ).toHaveLength(1)
    expect(
      findStaleClaims(
        'Az OurFilmbe a kameratekercsből töltitek fel a képeket.',
      ),
    ).toHaveLength(1)
  })

  it('catches it in our column of a comparison table', () => {
    const table = [
      '| Szempont | OurFilm | Once |',
      '| --- | --- | --- |',
      '| Képlimit | Korlátlan fotó | Testreszabható |',
    ].join('\n')

    expect(findStaleClaims(table)).toHaveLength(1)
  })

  it('catches it under a heading that names us', () => {
    const section = [
      '## Mit ad az OurFilm?',
      '',
      '- korlátlan fotó minden vendégnek;',
    ].join('\n')

    expect(findStaleClaims(section)).toHaveLength(1)
  })

  it('leaves a competitor’s unlimited plan alone', () => {
    expect(
      findStaleClaims('A Wedibox csomagjában korlátlan fotó szerepel.'),
    ).toEqual([])

    const table = [
      '| Szempont | OurFilm | Wedibox |',
      '| --- | --- | --- |',
      '| Képszám | 5/10/16/24/36 | Korlátlan fotó |',
    ].join('\n')
    expect(findStaleClaims(table)).toEqual([])
  })

  it('leaves the correction itself alone', () => {
    // These sentences are how the pack *fixes* the misconception. A linter
    // that flags them is a linter someone deletes.
    expect(
      findStaleClaims(
        'Az OurFilm nem egyszerű feltöltőalbum, hanem közös kamera.',
      ),
    ).toEqual([])
    expect(findStaleClaims('Az OurFilmben lehet korlátlanul fotózni?')).toEqual(
      [],
    )
  })
})

describe('the published content', () => {
  it('makes no pre-pivot claim about OurFilm', () => {
    const findings = getAllDocs().flatMap((doc) =>
      findStaleClaims(readFileSync(doc.filePath, 'utf8')).map(
        (finding) =>
          `${doc.filePath}\n    ${finding.text}\n    → ${finding.reason}`,
      ),
    )

    expect(findings).toEqual([])
  })
})
