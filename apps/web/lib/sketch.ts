import { rgbaToThumbHash, thumbHashToDataURL } from 'thumbhash'

/**
 * A photo's colour sketch: a ThumbHash, as base64.
 *
 * The reveal-locked wall's one piece of the photo itself. About 25 bytes of
 * low-frequency colour and layout, computed on the uploading phone from the
 * bitmap it has already decoded, and with no detail in it to recover — see
 * `supabase/migrations/20261027213046_photo_sketch.sql` for why that is the
 * line, and why a CSS blur over the real thumbnail is not.
 *
 * Optional at every step. Anything that goes wrong here costs a tile its
 * sketch, never a photo its upload, so nothing in this file throws.
 */

/** ThumbHash's own ceiling on the image it summarises. */
export const SKETCH_EDGE = 100

/** What `commit_shot` will store; anything else it drops. */
const SKETCH_PATTERN = /^[A-Za-z0-9+/]{8,62}={0,2}$/

export function isSketch(value: unknown): value is string {
  return typeof value === 'string' && SKETCH_PATTERN.test(value)
}

/** Encode `width`×`height` RGBA pixels (each at most `SKETCH_EDGE`). */
export function encodeSketch(
  width: number,
  height: number,
  rgba: Uint8ClampedArray | Uint8Array,
): string | null {
  try {
    const hash = rgbaToThumbHash(width, height, rgba)
    let binary = ''
    for (const byte of hash) binary += String.fromCharCode(byte)
    const sketch = btoa(binary)
    return isSketch(sketch) ? sketch : null
  } catch {
    return null
  }
}

/**
 * The sketch as a small PNG data URL, or null for a missing or malformed one.
 * Pure JavaScript, so the server render and the client draw the same tile.
 */
export function sketchDataUrl(sketch: string | null): string | null {
  if (!isSketch(sketch)) return null
  try {
    const binary = atob(sketch)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    return thumbHashToDataURL(bytes)
  } catch {
    return null
  }
}
