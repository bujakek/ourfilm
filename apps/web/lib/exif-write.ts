/**
 * Writes the capture time back into an exported JPEG.
 *
 * The counterpart to `lib/exif.ts`, and the reason both exist. Upload strips
 * EXIF by re-encoding through a canvas, which is what keeps GPS out of a public
 * bucket — but it also leaves the stored file with no date, and a date in the
 * database is invisible to everything the couple will actually open the album
 * with. Photos, Lightroom and Finder's "date taken" all read the file, not us.
 * A ZIP entry's timestamp is not a substitute: it lands as the file's
 * *modification* date, and Photos ignores that in favour of `DateTimeOriginal`
 * — falling back, when there is none, to the creation date, which is the moment
 * the archive was unzipped. That is why an imported album collapses onto a
 * single day.
 *
 * Only time tags go in. Not "GPS is omitted for now" — there is no code here
 * that could write a location, and there should never be: the coordinates were
 * destroyed on the guest's phone and never reached the server at all.
 */
// The explicit .ts extension is load-bearing, not a slip: it is what lets bare
// `node` import this module, and `pnpm test:exif` round-trips what is written
// here back through the reader. Dropping it to match the repo's other imports
// silently kills that test.
import { eventStamp, eventUtcOffset } from './format.ts'

/** Tag numbers, ordered as they must appear: ascending within each IFD. */
const TAG_DATETIME = 0x0132
const TAG_EXIF_IFD = 0x8769
const TAG_DATETIME_ORIGINAL = 0x9003
const TAG_DATETIME_DIGITIZED = 0x9004
const TAG_OFFSET_TIME = 0x9010
const TAG_OFFSET_TIME_ORIGINAL = 0x9011
const TAG_OFFSET_TIME_DIGITIZED = 0x9012

const TYPE_ASCII = 2
const TYPE_LONG = 4

/** How much of a JPEG to buffer while looking for the end of its header. The
 *  segments ahead of the pixel data run to a few hundred bytes in practice; an
 *  ICC profile is the only large one and stays well under this. */
const HEADER_LIMIT = 256 * 1024

function u16(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff]
}

function u32(value: number): number[] {
  return [
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ]
}

const asciiz = (text: string) => [...text].map((c) => c.charCodeAt(0)).concat(0)

/**
 * An APP1 segment carrying the capture time and nothing else.
 *
 * Both `DateTimeOriginal` and `DateTimeDigitized` are written, plus IFD0's
 * `DateTime`, because readers disagree about which one they trust — Photos
 * reads the first, some desktop tools only ever look at the last. Each gets its
 * matching offset tag, so the wall clock is not left to be guessed at.
 */
export function exifDateSegment(iso: string, timeZone?: string): Uint8Array {
  // The event's own zone, not the server's. A capture stamp and its offset are
  // the two halves of one fact, so both read from the same zone or the file
  // claims a time that disagrees with the offset beside it.
  const stamp = asciiz(eventStamp(iso, timeZone)) // "2026:08:15 14:32:10"
  const zone = asciiz(eventUtcOffset(iso, timeZone)) // "+02:00"

  // Little-endian TIFF. IFD0 carries DateTime and the sub-IFD pointer; the
  // sub-IFD carries the two capture stamps and all three offsets.
  const ifd0Count = 2
  const subCount = 5
  const ifd0Start = 8
  const subStart = ifd0Start + 2 + 12 * ifd0Count + 4
  const dataStart = subStart + 2 + 12 * subCount + 4

  const data: number[] = []
  /** ASCII values longer than four bytes live outside the entry, at an offset
   *  measured from the TIFF header. Every string here is. */
  const ascii = (value: number[]) => {
    const at = dataStart + data.length
    data.push(...value)
    return [...u16(TYPE_ASCII), ...u32(value.length), ...u32(at)]
  }

  const ifd0 = [
    ...u16(ifd0Count),
    ...u16(TAG_DATETIME),
    ...ascii(stamp),
    ...u16(TAG_EXIF_IFD),
    ...u16(TYPE_LONG),
    ...u32(1),
    ...u32(subStart),
    ...u32(0), // no IFD1: no embedded thumbnail
  ]

  const sub = [
    ...u16(subCount),
    ...u16(TAG_DATETIME_ORIGINAL),
    ...ascii(stamp),
    ...u16(TAG_DATETIME_DIGITIZED),
    ...ascii(stamp),
    ...u16(TAG_OFFSET_TIME),
    ...ascii(zone),
    ...u16(TAG_OFFSET_TIME_ORIGINAL),
    ...ascii(zone),
    ...u16(TAG_OFFSET_TIME_DIGITIZED),
    ...ascii(zone),
    ...u32(0),
  ]

  const tiff = [
    ...[0x49, 0x49], // "II"
    ...u16(42),
    ...u32(ifd0Start),
    ...ifd0,
    ...sub,
    ...data,
  ]
  const payload = [...asciiz('Exif'), 0, ...tiff]

  return new Uint8Array([
    0xff,
    0xe1,
    // Big-endian, unlike everything inside it: segment lengths are JPEG's, and
    // JPEG is big-endian regardless of the byte order the TIFF block declares.
    (payload.length + 2) >> 8,
    (payload.length + 2) & 0xff,
    ...payload,
  ])
}

/** Rebuild a JPEG header with our segment in place of any existing Exif APP1.
 *  Returns null when the bytes are not a header we fully recognise, so the
 *  caller can pass the original through untouched rather than risk mangling
 *  someone's photo. */
function rewriteHeader(
  buf: Uint8Array,
  segment: Uint8Array,
): Uint8Array | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null

  const keep: [number, number][] = [] // [start, end) of segments to retain
  let off = 2

  for (;;) {
    if (off + 4 > buf.length) return null
    if (buf[off] !== 0xff) return null
    const marker = buf[off + 1]

    // Start of scan: everything from here is pixel data, copied verbatim.
    if (marker === 0xda) break

    const size = (buf[off + 2] << 8) | buf[off + 3]
    if (size < 2 || off + 2 + size > buf.length) return null

    // Drop the existing Exif APP1. Two of them in one file is ambiguous, and
    // readers take the first — which would be ours, silently shadowing rather
    // than replacing. The one the canvas writes holds only pixel dimensions.
    const isExif =
      marker === 0xe1 &&
      buf[off + 4] === 0x45 && // E
      buf[off + 5] === 0x78 && // x
      buf[off + 6] === 0x69 && // i
      buf[off + 7] === 0x66 && // f
      buf[off + 8] === 0x00
    if (!isExif) keep.push([off, off + 2 + size])

    off += 2 + size
  }

  const kept = keep.reduce((n, [start, end]) => n + (end - start), 0)
  const tail = buf.length - off
  const out = new Uint8Array(2 + segment.length + kept + tail)

  out.set([0xff, 0xd8], 0)
  // Exif wants APP1 first after SOI, ahead of the JFIF APP0 the canvas emits.
  out.set(segment, 2)
  let at = 2 + segment.length
  for (const [start, end] of keep) {
    out.set(buf.subarray(start, end), at)
    at += end - start
  }
  out.set(buf.subarray(off), at)
  return out
}

function concat(parts: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total)
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

/**
 * Stream a stored JPEG with `segment` spliced into its header.
 *
 * Only the header is buffered — the pixel data, which is all but a fraction of
 * a percent of the file, streams straight through. An album of hundreds of
 * photos still costs a few hundred kilobytes of memory at a time, which is the
 * whole reason the export streams rather than buffers.
 */
export function withExifDate(
  source: ReadableStream<Uint8Array>,
  segment: Uint8Array,
): ReadableStream<Uint8Array> {
  const reader = source.getReader()

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const parts: Uint8Array[] = []
      let total = 0

      // Read until the header is complete, i.e. the rewrite succeeds. A photo
      // whose header never resolves within the cap is emitted untouched.
      while (total < HEADER_LIMIT) {
        const { value, done } = await reader.read()
        if (done) break
        parts.push(value)
        total += value.length
        const rewritten = rewriteHeader(concat(parts, total), segment)
        if (rewritten) {
          controller.enqueue(rewritten)
          return
        }
      }
      if (total > 0) controller.enqueue(concat(parts, total))
    },

    async pull(controller) {
      const { value, done } = await reader.read()
      if (done) controller.close()
      else controller.enqueue(value)
    },

    cancel(reason) {
      return reader.cancel(reason)
    },
  })
}
