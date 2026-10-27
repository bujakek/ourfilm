import { describe, expect, it } from 'vitest'

import { encodeSketch, isSketch, sketchDataUrl } from '@/lib/sketch'

/** A 4x3 image: a warm left half and a cool right half. */
function pixels() {
  const rgba = new Uint8ClampedArray(4 * 3 * 4)
  for (let i = 0; i < 12; i++) {
    const warm = i % 4 < 2
    rgba.set(warm ? [220, 120, 60, 255] : [40, 90, 200, 255], i * 4)
  }
  return rgba
}

describe('encodeSketch', () => {
  it('produces a short base64 hash the database will store', () => {
    const sketch = encodeSketch(4, 3, pixels())
    expect(sketch).not.toBeNull()
    expect(isSketch(sketch)).toBe(true)
    expect(sketch!.length).toBeLessThanOrEqual(64)
  })

  it('returns null rather than throwing for an image ThumbHash refuses', () => {
    expect(encodeSketch(200, 200, new Uint8ClampedArray(200 * 200 * 4))).toBe(
      null,
    )
  })
})

describe('sketchDataUrl', () => {
  it('draws a stored sketch as a PNG', () => {
    const url = sketchDataUrl(encodeSketch(4, 3, pixels()))
    expect(url).toMatch(/^data:image\/png;base64,/)
  })

  it('gives nothing for a missing or malformed sketch', () => {
    expect(sketchDataUrl(null)).toBeNull()
    expect(sketchDataUrl('not a sketch!')).toBeNull()
    expect(sketchDataUrl('x'.repeat(80))).toBeNull()
  })
})

describe('isSketch', () => {
  it('matches what commit_shot accepts, padding included', () => {
    expect(isSketch('A'.repeat(62) + '==')).toBe(true)
    expect(isSketch('A'.repeat(63) + '==')).toBe(false)
    expect(isSketch('short')).toBe(false)
  })
})
