// Browser APIs only. Importing this from a Server Component would compile
// fine and then fail at runtime on createImageBitmap; this makes it a build
// error instead, mirroring `server-only` on the query modules.
import 'client-only'

import { readCaptureTime } from './exif'

/**
 * Browser-side photo pipeline. Everything here runs on a guest's phone, on
 * venue wifi, with whatever memory the device has left.
 *
 * See `.cursor/skills/ourfilm-upload/SKILL.md` for why the numbers are what
 * they are. The short version: 4096px at q0.92 stays print-ready while cutting
 * a 48MP iPhone photo from ~8MB to under ~2.5MB.
 *
 * This runs on the main thread. Moving it to a worker was tried and reverted:
 * Turbopack (Next 16.3) does not compile `new Worker(new URL('./x.ts',
 * import.meta.url))` into a worker bundle — it emits the file as a *static
 * asset* and hands the raw TypeScript URL to the Worker constructor, which
 * fails on MIME type and on the un-transpiled source. Verified against four
 * variants: with and without the `.ts` extension, with and without
 * `{ type: 'module' }`, and at the top level rather than inside a try. Every
 * one produced `/_next/static/media/image-worker.<hash>.ts`. The failure is
 * silent at build time and would have looked like a working worker while
 * quietly running everything here anyway, so check the emitted asset before
 * trusting any future attempt.
 */

/** Long-edge cap. Also keeps the canvas under iOS Safari's ~16.7M pixel
 *  ceiling: a 4:3 photo at 4096 lands near 12.6M. Don't raise without
 *  rechecking that. */
const MAX_EDGE = 4096
const QUALITY = 0.92

/** Gallery tile. The grid must never load the full image — see CLAUDE.md. */
const THUMB_EDGE = 400
const THUMB_QUALITY = 0.8

/**
 * Lightbox render. The grid was always careful to serve the thumb; the
 * lightbox was not, and opening a photo used to decode the full 12.6MP master
 * into ~50MB of bitmap on the phone, once per swipe. A phone screen is around
 * 1200px on its long edge at 3x, so 1600px covers it with room to pinch-zoom
 * and costs an eighth of the pixels.
 *
 * Quality is lower than the master's 0.92 on purpose: this render is looked at
 * on a phone and thrown away, never printed. `storage_path` remains the
 * print-ready artefact and is what the ZIP export hands the couple.
 */
const VIEW_EDGE = 1600
const VIEW_QUALITY = 0.85

export type PreparedPhoto = {
  full: Blob
  thumb: Blob
  /** Screen-sized render for the lightbox. */
  view: Blob
  /** Dimensions of `full`, stored so the gallery can reserve grid space. */
  width: number
  height: number
  /** When the shutter fired, or null when the file carried no EXIF — a
   *  screenshot, a download, or anything already through a chat app. */
  takenAt: Date | null
}

/**
 * Cheap synchronous HEIC check.
 *
 * `heic-to` exports its own async `isHeic` that sniffs magic bytes, but calling
 * it would mean importing the package — and the whole point is that guests
 * whose phones send JPEG never download the decoder at all. Name and MIME are
 * enough to decide whether to pay for it.
 *
 * The extension check is not redundant: HEIC files routinely arrive with an
 * empty `type` from Android pickers and from iOS share sheets.
 */
export function isHeic(file: File): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)
}

/**
 * Decode any accepted file to a bitmap with EXIF orientation baked into the
 * pixels, so a canvas re-encode cannot leave the photo sideways.
 *
 * The HEIC branch asks `heic-to` for a bitmap rather than a JPEG blob. The
 * skill sketches blob -> `createImageBitmap`, but that encodes a full-size JPEG
 * and immediately decodes it again — two expensive passes over a 48MP image on
 * a phone, for an intermediate we throw away.
 */
async function decode(file: File): Promise<ImageBitmap> {
  if (isHeic(file)) {
    // Dynamic, and the /next entry specifically: it inlines its worker rather
    // than relying on the bundler emitting a separate asset.
    const { heicTo } = await import('heic-to/next')
    return heicTo({
      blob: file,
      type: 'bitmap',
      options: { imageOrientation: 'from-image' },
    })
  }

  return createImageBitmap(file, { imageOrientation: 'from-image' })
}

function scaledSize(bitmap: ImageBitmap, maxEdge: number) {
  // Never upscale: a small photo stays exactly as it is.
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  return {
    width: Math.round(bitmap.width * scale),
    height: Math.round(bitmap.height * scale),
  }
}

/**
 * Resample to an exact size using the browser's own scaler.
 *
 * The alternative — handing the full bitmap to `drawImage` and letting it
 * shrink — is both the most expensive step in the pipeline and the worst
 * looking. The thumbnail is a 10x reduction, and a single-pass canvas
 * downscale aliases badly on exactly the detail guests notice, because the
 * grid is the only thing most of them ever look at. `createImageBitmap`
 * resizes on the browser's own thread with a real filter, and hands back a
 * bitmap the encoder then blits 1:1.
 *
 * Returns null rather than throwing when the browser will not honour the
 * request, because the caller has a working fallback. The dimension check is
 * the important part: Safari has historically accepted `resizeWidth` and
 * `resizeHeight` while ignoring `resizeQuality`, and an implementation that
 * ignored the size options too would silently hand back the full-size bitmap —
 * which the encoder would happily turn into a 4096px "thumbnail" and put in
 * the gallery grid. Verify, never assume.
 */
async function resizedBitmap(
  bitmap: ImageBitmap,
  width: number,
  height: number,
): Promise<ImageBitmap | null> {
  try {
    const resized = await createImageBitmap(bitmap, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: 'high',
    })
    if (resized.width !== width || resized.height !== height) {
      resized.close()
      return null
    }
    return resized
  } catch {
    return null
  }
}

async function toJpeg(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  // OffscreenCanvas landed in Safari 16.4. Plenty of phones at a wedding are
  // older than that, and a guest whose upload silently fails is exactly the
  // data point this pilot cannot afford to lose.
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height)
    // Wide gamut. A 2D context is sRGB by default, which silently clips
    // everything a phone camera captures outside it — most visibly in skin
    // tones and foliage. Browsers without the option ignore it and fall back
    // to sRGB, so this is safe to ask for unconditionally.
    const ctx = canvas.getContext('2d', { colorSpace: 'display-p3' })
    if (!ctx) throw new Error('2D context unavailable')
    // Only matters when `resizedBitmap` declined and this draw is doing the
    // downscale itself, but the default 'low' visibly aliases when it is.
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, width, height)
    return canvas.convertToBlob({ type: 'image/jpeg', quality })
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { colorSpace: 'display-p3' })
  if (!ctx) throw new Error('2D context unavailable')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('Canvas encoding failed')),
      'image/jpeg',
      quality,
    )
  })
}

/** Encode at an exact size, resampling first when the source is larger. */
async function encodeAt(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  if (width === bitmap.width && height === bitmap.height) {
    return toJpeg(bitmap, width, height, quality)
  }

  const resized = await resizedBitmap(bitmap, width, height)
  try {
    // Falling back to `bitmap` means the encoder does the downscale itself,
    // which is the old behaviour and still correct — just slower and softer.
    return await toJpeg(resized ?? bitmap, width, height, quality)
  } finally {
    resized?.close()
  }
}

/**
 * Decode once, encode three times. Producing the smaller renders from the
 * bitmap already in memory costs a resize each rather than another decode of a
 * large file — which is why adding the lightbox render is close to free here
 * and saves a full 12.6MP decode on every phone that later views the photo.
 *
 * Call this **sequentially** across a selection. One photo may be preparing
 * while another uploads, but two decodes at once will run mobile Safari out of
 * memory and take the tab with it.
 */
export async function prepareForUpload(file: File): Promise<PreparedPhoto> {
  // Before `decode`, and emphatically before the re-encode below, which is what
  // destroys it. Reading it afterwards would always return null.
  const takenAt = await readCaptureTime(file)

  const bitmap = await decode(file)
  return prepareFromBitmap(bitmap, takenAt)
}

/**
 * The same three renders, from a bitmap the caller already holds.
 *
 * This is the live camera's entry point. A frame grabbed off `<video>` is
 * already decoded pixels, so routing it through `prepareForUpload` would mean
 * encoding it to a JPEG only to decode that JPEG straight back — one wasted
 * encode/decode round trip per shutter press, on a phone, in the one
 * interaction the product exists to make feel instant.
 *
 * A live frame carries no EXIF, so `takenAt` is passed in: the camera knows
 * when the shutter was pressed, which is a better answer than null and the same
 * answer a file's EXIF would have given.
 *
 * Takes ownership of the bitmap and closes it.
 */
export async function prepareFromBitmap(
  bitmap: ImageBitmap,
  takenAt: Date | null,
): Promise<PreparedPhoto> {
  try {
    const { width, height } = scaledSize(bitmap, MAX_EDGE)

    // Always re-encode, even when the original is smaller than the result.
    //
    // Passing the guest's file through untouched to save bytes looks like a
    // free win and is not: the canvas round trip is what strips EXIF, and EXIF
    // is where the GPS coordinates live. Object URLs are shareable and the
    // ZIP export hands every master to the host, so an untouched original
    // means a guest hands over where they were standing along with the photo.
    //
    // This is the common case, not an edge one — a phone JPEG at 4032px is
    // under the cap, so nothing is resized, and re-encoding an already
    // compressed JPEG at q0.92 usually produces a slightly larger file
    // (measured: 1.35MB in, 1.40MB out). Roughly 4% more bytes buys a
    // guarantee that no location data leaves the device.
    const full = await encodeAt(bitmap, width, height, QUALITY)

    const viewSize = scaledSize(bitmap, VIEW_EDGE)
    const view = await encodeAt(
      bitmap,
      viewSize.width,
      viewSize.height,
      VIEW_QUALITY,
    )

    const thumbSize = scaledSize(bitmap, THUMB_EDGE)
    const thumb = await encodeAt(
      bitmap,
      thumbSize.width,
      thumbSize.height,
      THUMB_QUALITY,
    )

    return { full, thumb, view, width, height, takenAt }
  } finally {
    // Phones are memory-tight and the next file is queued right behind this
    // one. Release in `finally` so a mid-pipeline throw cannot leak it.
    bitmap.close()
  }
}
