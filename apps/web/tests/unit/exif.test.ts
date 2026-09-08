/**
 * Regression test for `lib/exif.ts`.
 *
 *     pnpm test
 *
 * Runs offline against fixtures built here in memory — no database, no network,
 * nothing to clean up, unlike the tests under `supabase/tests/`.
 *
 * Fixtures are assembled byte by byte rather than dropped in as sample files.
 * That keeps the repo free of binaries and, more usefully, makes each case say
 * out loud what shape it is testing: a big-endian TIFF header, an APP1 sitting
 * behind a JFIF segment, a digitized stamp carrying the wrong offset tag.
 *
 * **What this does not prove:** the HEIC cases exercise the box layout written
 * *here*, not the one Apple writes. A real iPhone HEIC is still the only thing
 * that can confirm that path — see the open ticket in `docs/mvp-backlog.md`.
 */
import { describe, expect, it } from 'vitest'

import { exifDateSegment, withExifDate } from '@/lib/exif-write'
import { readCaptureTime } from '@/lib/exif'

const n16 = (v: number, le: boolean) =>
  le ? [v & 0xff, (v >> 8) & 0xff] : [(v >> 8) & 0xff, v & 0xff]

const n32 = (v: number, le: boolean) =>
  le
    ? [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]
    : [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff]

const chars = (s: string) => [...s].map((c) => c.charCodeAt(0))
const asciiz = (s: string) => [...chars(s), 0]

type TiffOptions = {
  le?: boolean
  original?: string
  digitized?: string
  modified?: string
  offsetOriginal?: string
  offsetDigitized?: string
}

/** A TIFF block: header, IFD0 pointing at an Exif sub-IFD, then the strings. */
function tiff({
  le = true,
  original,
  digitized,
  modified,
  offsetOriginal,
  offsetDigitized,
}: TiffOptions): number[] {
  // Tags within an IFD must be in ascending order.
  const sub: [number, number[]][] = []
  if (original) sub.push([0x9003, asciiz(original)])
  if (digitized) sub.push([0x9004, asciiz(digitized)])
  if (offsetOriginal) sub.push([0x9011, asciiz(offsetOriginal)])
  if (offsetDigitized) sub.push([0x9012, asciiz(offsetDigitized)])
  const ifd0Extra: [number, number[]][] = modified
    ? [[0x0132, asciiz(modified)]]
    : []

  const ifd0Count = ifd0Extra.length + 1 // + the Exif sub-IFD pointer
  const ifd0Start = 8
  const subStart = ifd0Start + 2 + 12 * ifd0Count + 4
  const dataStart = subStart + 2 + 12 * sub.length + 4

  const data: number[] = []
  const entry = (tag: number, value: number[]) => {
    const payload =
      value.length <= 4
        ? [...value, ...Array(4 - value.length).fill(0)]
        : n32(dataStart + data.length, le)
    if (value.length > 4) data.push(...value)
    return [
      ...n16(tag, le),
      ...n16(2, le),
      ...n32(value.length, le),
      ...payload,
    ]
  }

  const head = [
    ...chars(le ? 'II' : 'MM'),
    ...n16(42, le),
    ...n32(ifd0Start, le),
  ]
  const first = [
    ...n16(ifd0Count, le),
    ...ifd0Extra.flatMap(([tag, value]) => entry(tag, value)),
    ...n16(0x8769, le),
    ...n16(4, le),
    ...n32(1, le),
    ...n32(subStart, le),
    ...n32(0, le),
  ]
  const second = [
    ...n16(sub.length, le),
    ...sub.flatMap(([tag, value]) => entry(tag, value)),
    ...n32(0, le),
  ]
  return [...head, ...first, ...second, ...data]
}

const JFIF = [
  0xff,
  0xe0,
  ...n16(16, false),
  ...asciiz('JFIF'),
  1,
  2,
  0,
  0,
  1,
  0,
  1,
  0,
  0,
]

function jpeg(block: number[] | null, before: number[] = []): Blob {
  const app1 = block
    ? [
        0xff,
        0xe1,
        ...n16(block.length + 8, false),
        ...asciiz('Exif'),
        0,
        ...block,
      ]
    : []
  const out = [
    0xff,
    0xd8,
    ...before,
    ...app1,
    0xff,
    0xda,
    ...n16(2, false),
    ...Array(64).fill(0),
    0xff,
    0xd9,
  ]
  return new Blob([new Uint8Array(out)])
}

const box = (type: string, payload: number[]) => [
  ...n32(8 + payload.length, false),
  ...chars(type),
  ...payload,
]
const fullBox = (type: string, version: number, payload: number[]) =>
  box(type, [version, 0, 0, 0, ...payload])

function heic(block: number[]): Blob {
  const payload = [...n32(6, false), ...asciiz('Exif'), 0, ...block]
  const meta = (offset: number, length: number) => {
    const hdlr = fullBox('hdlr', 0, [
      ...Array(4).fill(0),
      ...chars('pict'),
      ...Array(12).fill(0),
    ])
    const infe = fullBox('infe', 2, [
      ...n16(1, false),
      ...n16(0, false),
      ...chars('Exif'),
    ])
    const iinf = fullBox('iinf', 0, [...n16(1, false), ...infe])
    const iloc = fullBox('iloc', 1, [
      0x44, // offset_size 4, length_size 4
      0x00, // base_offset_size 0, index_size 0
      ...n16(1, false), // item_count
      ...n16(1, false), // item_ID
      ...n16(0, false), // reserved + construction_method 0
      ...n16(0, false), // data_reference_index
      ...n16(1, false), // extent_count
      ...n32(offset, false),
      ...n32(length, false),
    ])
    return fullBox('meta', 0, [...hdlr, ...iinf, ...iloc])
  }
  const ftyp = box('ftyp', [
    ...chars('heic'),
    ...n32(0, false),
    ...chars('heicmif1'),
  ])
  // The extent offset is absolute, and the meta box's own size does not depend
  // on it — so measure once with a placeholder, then build for real.
  const offset = ftyp.length + meta(0, 0).length + 8
  return new Blob([
    new Uint8Array([
      ...ftyp,
      ...meta(offset, payload.length),
      ...box('mdat', payload),
    ]),
  ])
}

const AT = '2026:08:15 14:32:10'
// A stamp with no offset tag is defined to mean wall clock in the device's own
// zone, so the expectation has to be built the same way. This pins down that
// the tag was found and the fallback taken — the arithmetic is the platform's.
const LOCAL = new Date(2026, 7, 15, 14, 32, 10).toISOString()
const EXACT = '2026-08-15T12:32:10.000Z' // 14:32:10 +02:00

const cases: [string, Blob, string | null][] = [
  [
    'DateTimeOriginal + offset',
    jpeg(tiff({ original: AT, offsetOriginal: '+02:00' })),
    EXACT,
  ],
  [
    'big-endian (MM) byte order',
    jpeg(tiff({ le: false, original: AT, offsetOriginal: '+02:00' })),
    EXACT,
  ],
  [
    'APP1 behind a JFIF segment',
    jpeg(tiff({ original: AT, offsetOriginal: '+02:00' }), JFIF),
    EXACT,
  ],
  ['no offset tag -> device zone', jpeg(tiff({ original: AT })), LOCAL],
  [
    'DateTimeDigitized + its own offset',
    jpeg(tiff({ digitized: AT, offsetDigitized: '+02:00' })),
    EXACT,
  ],
  [
    'digitized ignores an *original* zone',
    jpeg(tiff({ digitized: AT, offsetOriginal: '+02:00' })),
    LOCAL,
  ],
  ['falls back to IFD0 DateTime', jpeg(tiff({ modified: AT })), LOCAL],
  [
    'HEIC via meta/iinf/iloc',
    heic(tiff({ original: AT, offsetOriginal: '+02:00' })),
    EXACT,
  ],
  ['HEIC, no offset tag', heic(tiff({ original: AT })), LOCAL],
  [
    'zeroed stamp (clock never set)',
    jpeg(tiff({ original: '0000:00:00 00:00:00' })),
    null,
  ],
  [
    'dead clock battery (1980)',
    jpeg(tiff({ original: '1980:01:01 00:00:00' })),
    null,
  ],
  [
    'implausible future (2099)',
    jpeg(tiff({ original: '2099:01:01 12:00:00' })),
    null,
  ],
  ['no EXIF at all', jpeg(null, JFIF), null],
  [
    'truncated mid-EXIF',
    new Blob([(await jpeg(tiff({ original: AT })).arrayBuffer()).slice(0, 24)]),
    null,
  ],
  [
    'not an image at all',
    new Blob([new Uint8Array(2048).map((_, i) => i % 256)]),
    null,
  ],
]

// Round trip: what the export writes must be what the reader reads back. These
// two modules are the only places in the codebase that know the EXIF byte
// layout, and nothing else would notice if they drifted apart.
async function stamped(iso: string, base: Blob): Promise<Blob> {
  const stream = base.stream() as ReadableStream<Uint8Array>
  const out = withExifDate(stream, exifDateSegment(iso))
  return new Blob([await new Response(out).arrayBuffer()])
}

// A canvas-encoded upload carries an Exif APP1 holding only pixel dimensions,
// so the writer has to replace one rather than add the first.
const canvasLike = jpeg(tiff({}), JFIF)
const plain = jpeg(null, JFIF)

cases.push(
  ['written date reads back', await stamped(EXACT, plain), EXACT],
  ['replaces an existing Exif APP1', await stamped(EXACT, canvasLike), EXACT],
  [
    'winter date keeps its own offset',
    await stamped('2026-01-15T12:32:10.000Z', plain),
    '2026-01-15T12:32:10.000Z',
  ],
)

describe('readCaptureTime', () => {
  it.each(cases)('%s', async (_name, file, expected) => {
    const got = await readCaptureTime(file)
    expect(got ? got.toISOString() : null).toBe(expected)
  })
})
