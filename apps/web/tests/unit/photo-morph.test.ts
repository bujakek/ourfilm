import { describe, expect, it } from 'vitest'

import { morphFrom } from '@/lib/photo-morph'

/**
 * The sign of `x` and `y` is the whole test.
 *
 * Everything else about the open animation is visible the moment you run it;
 * a flipped sign is visible too, but only on a device, and only as "the photo
 * comes in from the wrong side" — which is exactly the kind of thing that gets
 * shipped.
 */
describe('morphFrom', () => {
  const viewer = { top: 100, left: 0, width: 400, height: 600 }

  it('is the identity when the boxes already agree', () => {
    expect(morphFrom(viewer, viewer)).toEqual({ x: 0, y: 0, scale: 1 })
  })

  it('shrinks the viewer onto a tile and moves it there', () => {
    // A 100px tile in the top-left corner of the screen.
    const tile = { top: 0, left: 0, width: 100, height: 100 }
    const { x, y, scale } = morphFrom(tile, viewer)

    expect(scale).toBe(0.25)
    // Tile centre (50, 50) against viewer centre (200, 400): up and to the left.
    expect(x).toBe(-150)
    expect(y).toBe(-350)
  })

  it('moves the other way for a tile below and right of centre', () => {
    const tile = { top: 500, left: 300, width: 100, height: 100 }
    const { x, y } = morphFrom(tile, viewer)
    expect(x).toBeGreaterThan(0)
    expect(y).toBeGreaterThan(0)
  })

  it('does not divide by a viewer that has not been laid out', () => {
    const tile = { top: 0, left: 0, width: 100, height: 100 }
    expect(
      morphFrom(tile, { top: 0, left: 0, width: 0, height: 0 }).scale,
    ).toBe(1)
  })
})
