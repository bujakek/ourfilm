'use client'

import {
  MISSING_PHOTOS_ENTRY,
  missingPhotosNote,
  wallClockToDate,
  type ExportManifest,
  type ExportResponse,
  type PreparedExport,
} from '@/lib/album-export'
import { exifDateSegmentFrom, withExifDate } from '@/lib/exif-write'
import { track } from '@/lib/telemetry'
import { Download } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/**
 * The Album button.
 *
 * Asks the export endpoint what should happen and does it. A small album
 * comes back as a manifest and is zipped right here, in the host's browser,
 * from the public masters — a second or two, no queue, no round trip through
 * a function. A host who shot three test photos and tapped this is deciding
 * whether the promise on the landing page is real, and "we will let you know"
 * is the wrong answer to a three-photo album.
 *
 * A large album is prepared elsewhere. While the worker is switched off that
 * is the streaming route, and the button navigates to it. With the worker on,
 * one tap asks for an archive and the button then polls until it is ready,
 * showing `Album készítése… 487 kép`; the host may also just leave — the
 * email says when it is done — and come back to a `ready` button that carries
 * a fresh signed URL each time the page asks.
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
  | { kind: 'preparing'; prepared: PreparedExport }
  | { kind: 'ready'; prepared: PreparedExport }
  | { kind: 'failed'; where: 'browser' | 'prepared' }

type Stage = 'manifest' | 'fetch' | 'zip' | 'save'

/** How often the page asks while a job is in flight. The email covers the
 *  host who leaves; this covers the one who stays. */
const POLL_MS = 4_000

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
  initial,
}: {
  /** The JSON export endpoint for this event. */
  endpoint: string
  /** Telemetry only. */
  eventId: string
  photoCount: number
  locale: 'en' | 'hu'
  /** What the server already knew when it rendered the page, so a host
   *  returning to a ready album sees the download without a tap. */
  initial?: ExportResponse | null
}) {
  const en = locale === 'en'
  const [phase, setPhase] = useState<Phase>(() => fromResponse(initial))
  const busy = phase.kind === 'asking' || phase.kind === 'zipping'
  // The download anchor lives in the DOM for the whole component's life so
  // iOS Safari treats the click as user-initiated rather than a popup.
  const anchor = useRef<HTMLAnchorElement>(null)

  // Poll while a job is in flight. Keyed on the phase kind so a state update
  // that keeps the kind does not restart the timer.
  const preparing = phase.kind === 'preparing'
  useEffect(() => {
    if (!preparing) return
    let cancelled = false
    const tick = async () => {
      try {
        const answer = await ask(endpoint, 'GET')
        if (!cancelled) setPhase(fromResponse(answer))
      } catch {
        // A poll that fails is not a failed export; the next tick asks again.
      }
    }
    const timer = setInterval(tick, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [preparing, endpoint])

  async function run() {
    // A ready archive: the button is a download link.
    if (phase.kind === 'ready' && phase.prepared.url) {
      window.location.assign(phase.prepared.url)
      return
    }

    const startedAt = Date.now()
    setPhase({ kind: 'asking' })
    let stage: Stage = 'manifest'

    try {
      let answer = await ask(endpoint, 'GET')

      // Nothing usable prepared: ask for one. `POST` dedupes server-side.
      if (
        answer.mode === 'none' ||
        answer.mode === 'failed' ||
        answer.mode === 'expired'
      ) {
        answer = await ask(endpoint, 'POST')
      }

      track('album_export_requested', {
        event_id: eventId,
        photo_count: photoCount,
        mode: answer.mode === 'browser' ? 'browser' : 'prepared',
      })

      if (answer.mode === 'stream') {
        // The server owns the download. Assigning the location starts it
        // without leaving the page: the response is an attachment.
        window.location.assign(answer.url)
        setPhase({ kind: 'idle' })
        return
      }

      if (answer.mode !== 'browser') {
        const next = fromResponse(answer)
        if (next.kind === 'ready' && next.prepared.url) {
          window.location.assign(next.prepared.url)
        }
        setPhase(next)
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
      setPhase({ kind: 'failed', where: 'browser' })
    }
  }

  const label = labelFor(phase, en)
  const disabled = busy || phase.kind === 'preparing'

  return (
    <>
      <button
        type="button"
        onClick={run}
        disabled={disabled}
        aria-busy={disabled}
        className="inline-flex items-center gap-2 rounded-full border border-white/14 px-3.5 py-1.5 text-[11px] font-medium text-foreground/80 transition-colors hover:border-white/30 hover:text-foreground disabled:cursor-progress disabled:opacity-70"
      >
        <Download className="size-3.5" aria-hidden="true" />
        <span aria-live="polite">{label}</span>
      </button>
      <a ref={anchor} hidden aria-hidden="true" href="#" download />
    </>
  )
}

async function ask(
  endpoint: string,
  method: 'GET' | 'POST',
): Promise<ExportResponse> {
  const response = await fetch(endpoint, {
    method,
    headers: { accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`export ${response.status}`)
  return (await response.json()) as ExportResponse
}

function fromResponse(answer: ExportResponse | null | undefined): Phase {
  if (!answer) return { kind: 'idle' }
  switch (answer.mode) {
    case 'queued':
    case 'processing':
      return { kind: 'preparing', prepared: answer.prepared }
    case 'ready':
      return { kind: 'ready', prepared: answer.prepared }
    case 'failed':
      return { kind: 'failed', where: 'prepared' }
    default:
      return { kind: 'idle' }
  }
}

function labelFor(phase: Phase, en: boolean): string {
  switch (phase.kind) {
    case 'zipping':
      return en
        ? `Downloading… ${phase.done} / ${phase.total}`
        : `Letöltés… ${phase.done} / ${phase.total}`
    case 'asking':
      return en ? 'Preparing…' : 'Előkészítés…'
    case 'preparing':
      return en
        ? `Preparing the album… ${phase.prepared.photoCount} photos`
        : `Album készítése… ${phase.prepared.photoCount} kép`
    case 'ready': {
      const size = formatBytes(phase.prepared.byteSize, en)
      const short =
        phase.prepared.missingCount > 0
          ? en
            ? ` · ${phase.prepared.missingCount} missing`
            : ` · ${phase.prepared.missingCount} kép hiányzik`
          : ''
      return en
        ? `Download the album · ${phase.prepared.photoCount} photos${size ? ` · ${size}` : ''}${short}`
        : `Album letöltése · ${phase.prepared.photoCount} kép${size ? ` · ${size}` : ''}${short}`
    }
    case 'failed':
      return phase.where === 'browser'
        ? en
          ? 'Could not download the album. Retry'
          : 'Nem sikerült letölteni az albumot. Újra'
        : en
          ? 'Could not prepare the album. Retry'
          : 'Nem sikerült elkészíteni az albumot. Újra'
    default:
      return 'Album'
  }
}

function formatBytes(bytes: number | null, en: boolean): string {
  if (!bytes) return ''
  const gb = bytes / 1024 ** 3
  if (gb >= 1) return `${gb.toFixed(1).replace('.', en ? '.' : ',')} GB`
  const mb = bytes / 1024 ** 2
  return `${Math.max(1, Math.round(mb))} MB`
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
