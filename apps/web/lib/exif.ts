/**
 * Capture time, read before the pixels are touched.
 *
 * `prepareForUpload` destroys EXIF on purpose — the canvas round trip is what
 * keeps GPS coordinates out of a public bucket (see `lib/image.ts`). That wipe
 * takes the shutter time with it, so it has to be lifted out here first and
 * carried as a column instead. Metadata-as-data is the better end state
 * anyway: the album gets its real timeline and the photo still leaves the phone
 * knowing nothing about where it was taken.
 *
 * No `client-only` marker, unlike the rest of the pipeline. Nothing here
 * touches a browser API — `Blob` and `DataView` are both standard in Node —
 * and staying isomorphic is what makes the format parsing testable off-device.
 *
 * Bounds checking is `DataView`'s, which throws `RangeError` on a truncated or
 * malformed file. The single catch in `readCaptureTime` turns every such
 * failure into `null`, because a photo with unreadable metadata must still
 * upload.
 */

/** EXIF tags. IFD0 holds the pointer and the file-modified fallback; the rest
 *  live in the Exif sub-IFD it points at. */
const TAG_DATETIME = 0x0132
const TAG_EXIF_IFD = 0x8769
const TAG_DATETIME_ORIGINAL = 0x9003
const TAG_DATETIME_DIGITIZED = 0x9004
const TAG_OFFSET_TIME = 0x9010
const TAG_OFFSET_TIME_ORIGINAL = 0x9011
const TAG_OFFSET_TIME_DIGITIZED = 0x9012

const TYPE_ASCII = 2

/** One read covers both formats: a JPEG's APP1 cannot exceed 64KB, and a HEIC's
 *  `meta` box sits at the front of the file. */
const HEAD_BYTES = 512 * 1024
/** A HEIC Exif item is a few KB; the cap only guards against a bogus length. */
const EXIF_ITEM_MAX = 128 * 1024

/** A phone whose clock never got set writes 1970, and a camera with a dead
 *  backup battery writes 1980 or 2000. Neither is a capture time. */
const EARLIEST = Date.UTC(1995, 0, 1)
/** Device clocks drift and some run in the wrong zone. Tolerate a bit of the
 *  future rather than discarding a real photo. */
const FUTURE_TOLERANCE_MS = 48 * 60 * 60 * 1000

type TiffAt = { view: DataView; tiff: number }

type Stamps = {
  original?: string
  digitized?: string
  modified?: string
  offsetOriginal?: string
  offsetDigitized?: string
  offset?: string
}

function fourcc(view: DataView, at: number): string {
  return String.fromCharCode(
    view.getUint8(at),
    view.getUint8(at + 1),
    view.getUint8(at + 2),
    view.getUint8(at + 3),
  )
}

/** Read one ASCII IFD entry. Values of four bytes or fewer sit inline in the
 *  entry; longer ones are an offset from the TIFF header. */
function ascii(
  view: DataView,
  tiff: number,
  le: boolean,
  entry: number,
): string | undefined {
  if (view.getUint16(entry + 2, le) !== TYPE_ASCII) return undefined
  const count = view.getUint32(entry + 4, le)
  if (count === 0 || count > 64) return undefined
  const at = count <= 4 ? entry + 8 : tiff + view.getUint32(entry + 8, le)

  let out = ''
  for (let i = 0; i < count; i++) {
    const code = view.getUint8(at + i)
    if (code === 0) break
    out += String.fromCharCode(code)
  }
  return out.trim() || undefined
}

function readIfd(
  view: DataView,
  tiff: number,
  le: boolean,
  ifdOffset: number,
  into: Stamps,
  depth = 0,
): void {
  // IFD0 → Exif sub-IFD is the only hop worth making; anything deeper is a
  // malformed pointer loop.
  if (depth > 1) return

  const base = tiff + ifdOffset
  const count = view.getUint16(base, le)
  // A real IFD holds tens of entries. A huge count means the offset was wrong
  // and the bytes are not an IFD at all.
  if (count > 512) return

  for (let i = 0; i < count; i++) {
    const entry = base + 2 + i * 12
    switch (view.getUint16(entry, le)) {
      case TAG_EXIF_IFD:
        readIfd(view, tiff, le, view.getUint32(entry + 8, le), into, depth + 1)
        break
      case TAG_DATETIME_ORIGINAL:
        into.original ??= ascii(view, tiff, le, entry)
        break
      case TAG_DATETIME_DIGITIZED:
        into.digitized ??= ascii(view, tiff, le, entry)
        break
      case TAG_DATETIME:
        into.modified ??= ascii(view, tiff, le, entry)
        break
      case TAG_OFFSET_TIME_ORIGINAL:
        into.offsetOriginal ??= ascii(view, tiff, le, entry)
        break
      case TAG_OFFSET_TIME_DIGITIZED:
        into.offsetDigitized ??= ascii(view, tiff, le, entry)
        break
      case TAG_OFFSET_TIME:
        into.offset ??= ascii(view, tiff, le, entry)
        break
    }
  }
}

function toDate(stamp: string, zone: string | undefined): Date | null {
  const parts = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(
    stamp,
  )
  if (!parts) return null
  const [, year, month, day, hour, minute, second] = parts
  // An unset clock is written as an all-zero stamp rather than by omitting the
  // tag, so the tag being present is not the same as it being meaningful.
  if (year === '0000' || month === '00' || day === '00') return null

  const offset = zone && /^[+-]\d{2}:\d{2}$/.test(zone) ? zone : null
  const date = offset
    ? new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`)
    : // EXIF 2.31 added the offset tag; iPhones write it, plenty of Android
      // cameras still do not. Without it the stamp is bare wall-clock with no
      // zone at all, so it gets read in the uploading device's zone. A guest at
      // the wedding is in the event's timezone, which makes this exactly right
      // in the case that matters and wrong by hours only for someone uploading
      // after flying home.
      new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
      )

  const time = date.getTime()
  if (Number.isNaN(time)) return null
  if (time < EARLIEST || time > Date.now() + FUTURE_TOLERANCE_MS) return null
  return date
}

function captureFromTiff({ view, tiff }: TiffAt): Date | null {
  const order = view.getUint16(tiff)
  const le = order === 0x4949
  if (!le && order !== 0x4d4d) return null
  if (view.getUint16(tiff + 2, le) !== 0x002a) return null

  const stamps: Stamps = {}
  readIfd(view, tiff, le, view.getUint32(tiff + 4, le), stamps)

  // Shutter time first, then when it was digitised, then the file's own
  // modified stamp — each with the zone tag that belongs to it.
  if (stamps.original) {
    return toDate(stamps.original, stamps.offsetOriginal ?? stamps.offset)
  }
  if (stamps.digitized) {
    return toDate(stamps.digitized, stamps.offsetDigitized ?? stamps.offset)
  }
  if (stamps.modified) return toDate(stamps.modified, stamps.offset)
  return null
}

/** "Exif\0\0", the APP1 payload marker. */
function isExifApp1(view: DataView, at: number): boolean {
  return view.getUint32(at) === 0x45786966 && view.getUint16(at + 4) === 0
}

function jpegTiff(view: DataView): TiffAt | null {
  let off = 2
  while (off + 4 <= view.byteLength) {
    if (view.getUint8(off) !== 0xff) return null
    const marker = view.getUint8(off + 1)

    // Fill bytes: any number of 0xFF may pad before a marker.
    if (marker === 0xff) {
      off += 1
      continue
    }
    // Standalone markers carry no length field.
    if (
      marker === 0xd8 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      off += 2
      continue
    }
    // Start of scan or end of image: only pixels from here on.
    if (marker === 0xda || marker === 0xd9) return null

    const size = view.getUint16(off + 2)
    if (size < 2) return null
    // APP1 is usually first but not always — Samsung and some editors put JFIF
    // or an ICC profile ahead of it, so the segments have to be walked.
    if (marker === 0xe1 && isExifApp1(view, off + 4)) {
      return { view, tiff: off + 10 }
    }
    off += 2 + size
  }
  return null
}

type Box = { type: string; start: number; end: number }

/** Walk one level of ISO base media file format boxes. */
function boxes(view: DataView, start: number, end: number): Box[] {
  const found: Box[] = []
  let off = start

  while (off + 8 <= end) {
    let size = view.getUint32(off)
    let header = 8
    if (size === 1) {
      // 64-bit size. Only `mdat` ever needs it, and we never walk into that.
      size = view.getUint32(off + 8) * 2 ** 32 + view.getUint32(off + 12)
      header = 16
    } else if (size === 0) {
      size = end - off
    }
    if (size < header) break

    const type = fourcc(view, off + 4)
    // A box may legitimately extend past the slice we read — `mdat` always
    // does. Record what is reachable and stop; that is not corruption.
    if (off + size > end) {
      found.push({ type, start: off + header, end })
      break
    }
    found.push({ type, start: off + header, end: off + size })
    off += size
  }
  return found
}

function sized(view: DataView, at: number, bytes: number): number {
  if (bytes === 0) return 0
  if (bytes === 4) return view.getUint32(at)
  if (bytes === 8) return view.getUint32(at) * 2 ** 32 + view.getUint32(at + 4)
  throw new Error(`unsupported field width: ${bytes}`)
}

/** The item id declared as type `Exif` in the item info box. */
function exifItemId(view: DataView, iinf: Box): number | null {
  const version = view.getUint8(iinf.start)
  let off = iinf.start + 4 // version + flags
  off += version === 0 ? 2 : 4 // entry_count

  for (const infe of boxes(view, off, iinf.end)) {
    if (infe.type !== 'infe') continue
    const v = view.getUint8(infe.start)
    // item_type only exists from version 2; earlier entries describe MIME
    // items in a different layout and never carry Exif in practice.
    if (v < 2) continue

    let p = infe.start + 4
    const id = v === 2 ? view.getUint16(p) : view.getUint32(p)
    p += v === 2 ? 2 : 4
    p += 2 // item_protection_index
    if (fourcc(view, p) === 'Exif') return id
  }
  return null
}

/** Where that item's bytes actually live, from the item location box. */
function itemExtent(
  view: DataView,
  iloc: Box,
  itemId: number,
): { offset: number; length: number } | null {
  const version = view.getUint8(iloc.start)
  let p = iloc.start + 4 // version + flags

  const widths = view.getUint8(p++)
  const offsetSize = widths >> 4
  const lengthSize = widths & 0xf
  const more = view.getUint8(p++)
  const baseOffsetSize = more >> 4
  const indexSize = version === 1 || version === 2 ? more & 0xf : 0

  const count = version < 2 ? view.getUint16(p) : view.getUint32(p)
  p += version < 2 ? 2 : 4

  for (let i = 0; i < count; i++) {
    const id = version < 2 ? view.getUint16(p) : view.getUint32(p)
    p += version < 2 ? 2 : 4

    let construction = 0
    if (version === 1 || version === 2) {
      construction = view.getUint16(p) & 0xf
      p += 2
    }
    p += 2 // data_reference_index

    const base = sized(view, p, baseOffsetSize)
    p += baseOffsetSize
    const extents = view.getUint16(p)
    p += 2

    for (let e = 0; e < extents; e++) {
      p += indexSize
      const offset = sized(view, p, offsetSize)
      p += offsetSize
      const length = sized(view, p, lengthSize)
      p += lengthSize

      // construction_method 0 means a plain file offset. The other two point
      // into `idat` or another item; no camera stores Exif that way, and
      // guessing at it would be worse than returning nothing.
      if (id === itemId && e === 0 && construction === 0) {
        return { offset: base + offset, length }
      }
    }
  }
  return null
}

async function heicTiff(file: Blob, head: DataView): Promise<TiffAt | null> {
  const meta = boxes(head, 0, head.byteLength).find((b) => b.type === 'meta')
  if (!meta) return null

  // `meta` is a FullBox: its children start after version and flags.
  const children = boxes(head, meta.start + 4, meta.end)
  const iinf = children.find((b) => b.type === 'iinf')
  const iloc = children.find((b) => b.type === 'iloc')
  if (!iinf || !iloc) return null

  const id = exifItemId(head, iinf)
  if (id === null) return null
  const extent = itemExtent(head, iloc, id)
  if (!extent || extent.length < 8) return null

  const bytes = await file
    .slice(
      extent.offset,
      extent.offset + Math.min(extent.length, EXIF_ITEM_MAX),
    )
    .arrayBuffer()
  const block = new DataView(bytes)

  // ISO/IEC 23008-12 ExifDataBlock: a four-byte count of the padding that
  // follows, then the TIFF header. In practice the padding is the same
  // "Exif\0\0" a JPEG carries, so the count is 6.
  return { view: block, tiff: 4 + block.getUint32(0) }
}

/**
 * The capture time a photo was taken at, or null when the file carries none —
 * screenshots, downloads, images already through a chat app, and most Android
 * gallery pickers.
 *
 * Dispatches on magic bytes rather than on filename or MIME type. That is not
 * pedantry: HEIC routinely arrives from Android pickers and iOS share sheets
 * with an empty `type` and no extension, which is the same reason `isHeic` in
 * the image pipeline checks both.
 */
export async function readCaptureTime(file: Blob): Promise<Date | null> {
  try {
    const head = new DataView(await file.slice(0, HEAD_BYTES).arrayBuffer())
    if (head.byteLength < 16) return null

    let found: TiffAt | null = null
    if (head.getUint16(0) === 0xffd8) {
      found = jpegTiff(head)
    } else if (fourcc(head, 4) === 'ftyp') {
      found = await heicTiff(file, head)
    }

    return found ? captureFromTiff(found) : null
  } catch {
    // Unreadable metadata must never cost a guest their photo.
    return null
  }
}
