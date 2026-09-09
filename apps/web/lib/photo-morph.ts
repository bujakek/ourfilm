/**
 * Where a photograph comes from, and where it goes back to.
 *
 * The viewer opens full-screen and the thumbnail that was tapped stays in the
 * grid behind it. This is the transform that makes the first one look like the
 * second: apply it and the full-size photo sits exactly over its own tile,
 * then animate it away and the photo grows out of the tile it came from.
 *
 * Pure, and separate from the component, because it is the one part of the
 * animation that can be wrong in a way nobody notices until a phone is in
 * their hand — a sign flipped and the photo flies in from the wrong corner.
 */

/** The parts of a `DOMRect` this needs. Not the whole thing, so a test can
 *  write one down. */
export type Box = {
  top: number
  left: number
  width: number
  height: number
}

export type Morph = { x: number; y: number; scale: number }

/**
 * The transform that puts `to` on top of `from`.
 *
 * **Uniform scale, taken from the width.** A tile is square and a photograph is
 * not, so no single scale makes the two boxes agree — one axis has to give.
 * Scaling both axes independently would make the image itself squash on the way
 * out, which is the one thing worse than a slightly loose landing; matching the
 * width and letting the height fall where it does reads as the photo growing
 * out of the tile, and never distorts a face.
 *
 * Centre to centre, because Motion's transform origin is the centre and its
 * template applies the translate before the scale.
 */
export function morphFrom(from: Box, to: Box): Morph {
  return {
    x: from.left + from.width / 2 - (to.left + to.width / 2),
    y: from.top + from.height / 2 - (to.top + to.height / 2),
    // A zero-width target would only happen if the viewer were measured while
    // display:none. Landing on 1 means "no morph", which is the safe answer.
    scale: to.width > 0 ? from.width / to.width : 1,
  }
}
