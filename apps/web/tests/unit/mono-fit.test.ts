import { describe, expect, it } from 'vitest'

import { MONO_ADVANCE_EM, fittedMonoSize } from '@/lib/mono-fit'

/** The px size the expression resolves to in a container `width` px wide. */
function resolve(expression: string, width: number): number {
  const match =
    /^min\((\d+(?:\.\d+)?)px, calc\(100cqi \/ (\d+(?:\.\d+)?)\)\)$/.exec(
      expression,
    )
  if (!match) throw new Error(`unexpected expression: ${expression}`)
  return Math.min(Number(match[1]), width / Number(match[2]))
}

describe('fittedMonoSize', () => {
  it('keeps the design size when the string fits', () => {
    const size = fittedMonoSize({ text: '24', maxPx: 30, trackingEm: -0.05 })
    // The host figures' widest cell on a 390px phone.
    expect(resolve(size, 96)).toBe(30)
  })

  it('shrinks a three-digit count to the width of a 320px cell', () => {
    const text = '100'
    const size = fittedMonoSize({ text, maxPx: 30, trackingEm: -0.05 })
    const px = resolve(size, 53)
    const drawn = text.length * (MONO_ADVANCE_EM - 0.05) * px

    expect(px).toBeLessThan(30)
    expect(drawn).toBeCloseTo(53, 5)
  })

  it('counts the cap suffix, which is drawn too', () => {
    const bare = resolve(fittedMonoSize({ text: '5', maxPx: 30 }), 40)
    const capped = resolve(fittedMonoSize({ text: '5/5', maxPx: 30 }), 40)
    expect(capped).toBeLessThan(bare)
  })

  it('never divides by zero for an empty string', () => {
    expect(fittedMonoSize({ text: '', maxPx: 13 })).toBe(
      'min(13px, calc(100cqi / 0.75))',
    )
  })
})
