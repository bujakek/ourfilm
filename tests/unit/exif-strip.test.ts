/**
 * The claim the privacy notice makes about metadata, checked against a real
 * JPEG that carries some.
 *
 *     pnpm test
 *
 * The notice says: "A feltöltött képekből a rendszer a tartós tárolás előtt
 * eltávolítja az EXIF-metaadatokat, ideértve az esetlegesen rögzített
 * helyadatokat is. Az eltávolítás tényét automatizált teszt ellenőrzi." This
 * is that test.
 *
 * The fixture is a **real image**, encoded by a real JPEG encoder (`sharp`,
 * already a devDependency) rather than a hand-written byte string, and then
 * given a genuine APP1 Exif segment carrying both a capture time and GPS
 * coordinates. Both halves matter: the encoder makes it a file a decoder will
 * actually accept, and the hand-built APP1 makes the test say out loud which
 * tags it is asserting about.
 *
 * **What this proves and what it does not.** `assertNoExifMetadata()` is the
 * guard that stands on the upload path, and it is exercised here against real
 * metadata in both directions. The stripping itself happens in a canvas, which
 * has no implementation in Node — so the property this suite can hold is "a
 * render carrying metadata is refused", not "the canvas strips it". The guard
 * is what makes those equivalent in production: a browser that ever stopped
 * dropping metadata on re-encode would fail here rather than ship coordinates
 * to a shared album.
 */
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { readCaptureTime, readJpegMetadata } from '@/lib/exif'
import { assertNoExifMetadata } from '@/lib/image'
import { exifDateSegment, withExifDate } from '@/lib/exif-write'

const u16le = (v: number) => [v & 0xff, (v >> 8) & 0xff]
const u32le = (v: number) => [
  v & 0xff,
  (v >>> 8) & 0xff,
  (v >>> 16) & 0xff,
  (v >>> 24) & 0xff,
]
const asciiz = (s: string) => [...s].map((c) => c.charCodeAt(0)).concat(0)

const TYPE_ASCII = 2
const TYPE_RATIONAL = 5
const TYPE_LONG = 4

const TAG_DATETIME = 0x0132
const TAG_GPS_IFD = 0x8825
const TAG_GPS_LAT_REF = 0x0001
const TAG_GPS_LAT = 0x0002

/**
 * A little-endian TIFF block whose IFD0 carries a capture time and a pointer
 * to a GPS sub-IFD holding real coordinates — 47°29'52"N, roughly Budapest.
 *
 * Laid out by hand so the offsets are visible: IFD0 at 8, the GPS IFD right
 * after it, then the values that do not fit in an entry's four bytes.
 */
function tiffWithGps(stamp: string): number[] {
  const ifd0Start = 8
  const ifd0Entries = 2
  const gpsStart = ifd0Start + 2 + 12 * ifd0Entries + 4
  const gpsEntries = 2
  const dataStart = gpsStart + 2 + 12 * gpsEntries + 4

  const stampBytes = asciiz(stamp) // 20 bytes for "YYYY:MM:DD HH:MM:SS"
  const stampAt = dataStart

  // Three rationals: degrees, minutes, seconds.
  const latAt = stampAt + stampBytes.length
  const lat = [
    ...u32le(47),
    ...u32le(1),
    ...u32le(29),
    ...u32le(1),
    ...u32le(52),
    ...u32le(1),
  ]

  const ifd0 = [
    ...u16le(ifd0Entries),
    ...u16le(TAG_DATETIME),
    ...u16le(TYPE_ASCII),
    ...u32le(stampBytes.length),
    ...u32le(stampAt),
    ...u16le(TAG_GPS_IFD),
    ...u16le(TYPE_LONG),
    ...u32le(1),
    ...u32le(gpsStart),
    ...u32le(0),
  ]

  const gps = [
    ...u16le(gpsEntries),
    ...u16le(TAG_GPS_LAT_REF),
    ...u16le(TYPE_ASCII),
    ...u32le(2),
    // Two bytes fit inside the entry itself; the rest of the field is padding.
    0x4e,
    0x00,
    0x00,
    0x00,
    ...u16le(TAG_GPS_LAT),
    ...u16le(TYPE_RATIONAL),
    ...u32le(3),
    ...u32le(latAt),
    ...u32le(0),
  ]

  return [
    0x49,
    0x49, // "II"
    ...u16le(42),
    ...u32le(ifd0Start),
    ...ifd0,
    ...gps,
    ...stampBytes,
    ...lat,
  ]
}

/** Splice an Exif APP1 in immediately after the SOI marker. */
function withGpsExif(jpeg: Uint8Array, stamp: string): Uint8Array {
  const tiff = tiffWithGps(stamp)
  const payload = [...asciiz('Exif').slice(0, 4), 0x00, 0x00, ...tiff]
  const app1 = [
    0xff,
    0xe1,
    ...[(payload.length + 2) >> 8, (payload.length + 2) & 0xff],
    ...payload,
  ]

  const out = new Uint8Array(jpeg.length + app1.length)
  out.set(jpeg.subarray(0, 2), 0)
  out.set(Uint8Array.from(app1), 2)
  out.set(jpeg.subarray(2), 2 + app1.length)
  return out
}

/** A real 64x64 JPEG, encoded by a real encoder. */
async function cleanJpeg(): Promise<Uint8Array> {
  const buffer = await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 3,
      background: { r: 180, g: 120, b: 90 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer()
  return new Uint8Array(buffer)
}

const STAMP = '2026:08:26 14:32:10'

describe('readJpegMetadata', () => {
  it('finds nothing in a freshly encoded JPEG', async () => {
    // What a canvas re-encode produces: an encoder writing pixels with no
    // metadata to carry across.
    expect(readJpegMetadata(await cleanJpeg())).toEqual({
      hasExif: false,
      hasGps: false,
    })
  })

  it('finds both the Exif block and the GPS pointer in the fixture', async () => {
    const fixture = withGpsExif(await cleanJpeg(), STAMP)
    expect(readJpegMetadata(fixture)).toEqual({ hasExif: true, hasGps: true })
  })

  it('the fixture is genuinely readable Exif, not an opaque blob', async () => {
    // If the reader could not parse it, the assertions above would prove
    // nothing about real photographs. Reading the capture time back out is
    // what makes it a real Exif block.
    const fixture = withGpsExif(await cleanJpeg(), STAMP)
    const takenAt = await readCaptureTime(new Blob([fixture as BlobPart]))
    expect(takenAt).not.toBeNull()
    expect(takenAt?.getUTCFullYear()).toBe(2026)
  })

  it('treats a truncated header as no metadata rather than throwing', () => {
    expect(readJpegMetadata(Uint8Array.from([0xff, 0xd8, 0xff]))).toEqual({
      hasExif: false,
      hasGps: false,
    })
  })
})

describe('assertNoExifMetadata', () => {
  it('passes a render that carries nothing', async () => {
    await expect(
      assertNoExifMetadata(new Blob([(await cleanJpeg()) as BlobPart])),
    ).resolves.toBeUndefined()
  })

  it('refuses a render that still carries GPS', async () => {
    const fixture = withGpsExif(await cleanJpeg(), STAMP)
    await expect(
      assertNoExifMetadata(new Blob([fixture as BlobPart])),
    ).rejects.toThrow(/GPS/)
  })
})

describe('the one thing ever written back', () => {
  it('the export segment carries a time and no location', async () => {
    // `lib/exif-write.ts` restores a capture time into the ZIP export so
    // Photos and Lightroom show a real timeline. It has no code that could
    // write a coordinate, and this is the assertion that keeps it that way.
    const clean = await cleanJpeg()
    const source = new Blob([clean as BlobPart]).stream()
    const stamped = withExifDate(
      source,
      exifDateSegment('2026-08-26T12:32:10.000Z', 'Europe/Budapest'),
    )

    const chunks: Uint8Array[] = []
    const reader = stamped.getReader()
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      chunks.push(value)
    }
    const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0))
    let at = 0
    for (const chunk of chunks) {
      out.set(chunk, at)
      at += chunk.length
    }

    expect(readJpegMetadata(out)).toEqual({ hasExif: true, hasGps: false })
  })
})
