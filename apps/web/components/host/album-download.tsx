'use client'

import {
  MISSING_PHOTOS_ENTRY,
  missingPhotosNote,
  wallClockToDate,
  type ExportManifest,
  type ExportResponse,
} from '@/lib/album-export'
import { exifDateSegmentFrom, withExifDate } from '@/lib/exif-write'
import { track } from '@/lib/telemetry'
import { Download } from 'lucide-react'
import { useRef, useState } from 'react'

/**
 * The Album button.
 *
 * Asks the export endpoint what should happen and does it. A small album
 * comes back as a manifest and is zipped right here, in the host's browser,
 * from the public masters — a second or two, no queue, no round trip through
 * a function. A host who shot three test photos and tapped this is deciding
 * whether the promise on the landing page is real, and "we will let you know"
 * is the wrong answer to a three-photo album. A large album is prepared
 * elsewhere; the endpoint says where, and today that is the streaming route.
 *
 * The browser zip and the server zip start from the same manifest
 * (`lib/album-export.ts`) and use the same EXIF splice, so they produce the
 * same archive. What this component adds is only the bytes' destination: a
 * blob handed to the save dialog. That blob is also why the small-album
 * threshold exists — see `BROWSER_EXPORT_MAX_PHOTOS`.
 */

type Phase =
  | { kind: 'idle' }
  | { kind: 'asking' }
  | { kind: 'zipping'; done: number; total: number }
  | { kind: 'failed' }

type Stage = 'manifest' | 'fetch' | 'zip' | 'save'

class StagedError extends Error {
  constructor(
    readonly stage: Stage,
    cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : String(cause), { cause })
    this.name = cause instanceof Error ? cause.name : 'Error'
  }
}

export function AlbumDownload({
  endpoint,
  eventId,
  photoCount,
  locale,
}: {
  /** The JSON export endpoint for this event. */
  endpoint: string
  /** Telemetry only. */
  eventId: string
  photoCount: number
  locale: 'en' | 'hu'
}) {
  const en = locale === 'en'
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const busy = phase.kind === 'asking' || phase.kind === 'zipping'
  // The download anchor lives in the DOM for the whole component's life so
  // iOS Safari treats the click as user-initiated rather than a popup.
  const anchor = useRef<HTMLAnchorElement>(null)

  async function run() {
    const startedAt = Date.now()
    setPhase({ kind: 'asking' })
    let stage: Stage = 'manifest'

    try {
      const response = await fetch(endpoint, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
      })
      if (!response.ok) throw new Error(`export ${response.status}`)
      const answer = (await response.json()) as ExportResponse

      track('album_export_requested', {
        event_id: eventId,
        photo_count: photoCount,
        mode: answer.mode,
      })

      if (answer.mode === 'prepared') {
        // The server owns the download. Assigning the location starts it
        // without leaving the page: the response is an attachment.
        window.location.assign(answer.url)
        setPhase({ kind: 'idle' })
        return
      }

      stage = 'fetch'
      const total = answer.manifest.entries.length
      setPhase({ kind: 'zipping', done: 0, total })
      const missing: string[] = []
      const entries = zipEntries(answer.manifest, missing, (done) =>
        setPhase({ kind: 'zipping', done, total }),
      )

      stage = 'zip'
      const { downloadZip } = await import('client-zip')
      const blob = await downloadZip(entries).blob()

      stage = 'save'
      save(anchor.current, blob, answer.manifest.filename)

      track('album_export_browser_finished', {
        event_id: eventId,
        photo_count: total,
        missing_count: missing.length,
        elapsed_ms: Date.now() - startedAt,
      })
      setPhase({ kind: 'idle' })
    } catch (e) {
      const failure = e instanceof StagedError ? e : new StagedError(stage, e)
      track('album_export_browser_failed', {
        event_id: eventId,
        photo_count: photoCount,
        stage: failure.stage,
        error_class: failure.name,
      })
      setPhase({ kind: 'failed' })
    }
  }

  const label =
    phase.kind === 'zipping'
      ? en
        ? `Downloading… ${phase.done} / ${phase.total}`
        : `Letöltés… ${phase.done} / ${phase.total}`
      : phase.kind === 'asking'
        ? en
          ? 'Preparing…'
          : 'Előkészítés…'
        : phase.kind === 'failed'
          ? en
            ? 'Could not download the album. Retry'
            : 'Nem sikerült letölteni az albumot. Újra'
          : 'Album'

  return (
    <>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        aria-busy={busy}
        className="inline-flex items-center gap-2 rounded-full border border-white/14 px-3.5 py-1.5 text-[11px] font-medium text-foreground/80 transition-colors hover:border-white/30 hover:text-foreground disabled:cursor-progress disabled:opacity-70"
      >
        <Download className="size-3.5" aria-hidden="true" />
        <span aria-live="polite">{label}</span>
      </button>
      <a ref={anchor} hidden aria-hidden="true" href="#" download />
    </>
  )
}

/**
 * The manifest's entries, one at a time, in the shape client-zip takes.
 *
 * Sequential on purpose: one master in flight keeps memory at one photo, and
 * the point of the browser path is that it finishes in a couple of seconds
 * anyway. A master that will not fetch is recorded, not fatal — the archive
 * says what it is short of, exactly as the server's does.
 */
async function* zipEntries(
  manifest: ExportManifest,
  missing: string[],
  onProgress: (done: number) => void,
) {
  let done = 0
  for (const entry of manifest.entries) {
    let response: Response
    try {
      response = await fetch(entry.url)
    } catch (e) {
      throw new StagedError('fetch', e)
    }
    done += 1
    onProgress(done)

    if (!response.ok || !response.body) {
      missing.push(entry.name)
      continue
    }

    yield {
      name: entry.name,
      lastModified: wallClockToDate(entry.lastModified),
      input: entry.exif
        ? withExifDate(
            response.body,
            exifDateSegmentFrom(entry.exif.stamp, entry.exif.offset),
          )
        : response,
    }
  }

  if (missing.length > 0) {
    yield {
      name: MISSING_PHOTOS_ENTRY,
      lastModified: new Date(),
      input: missingPhotosNote(missing),
    }
  }
}

function save(anchor: HTMLAnchorElement | null, blob: Blob, filename: string) {
  if (!anchor) throw new StagedError('save', new Error('no anchor'))
  const href = URL.createObjectURL(blob)
  try {
    anchor.href = href
    anchor.download = filename
    anchor.click()
  } finally {
    // Not immediately: Safari reads the URL after the click returns. A minute
    // is far longer than any save dialog needs and short enough that a host
    // downloading twice does not keep two albums in memory.
    setTimeout(() => URL.revokeObjectURL(href), 60_000)
  }
}
