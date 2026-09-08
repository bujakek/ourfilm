import {
  MISSING_PHOTOS_ENTRY,
  missingPhotosNote,
  wallClockToDate,
  type ExportEntry,
  type ExportJob,
  type ExportUpload,
} from '@ourfilm/shared/export-job'
import { exifDateSegmentFrom, withExifDate } from '@ourfilm/shared/exif-splice'
import archiver from 'archiver'
import { createReadStream, createWriteStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { Upload } from 'tus-js-client'

import { env } from './env.ts'
import { WorkerFailure, isDiskFull } from './failure.ts'

/**
 * Turn a manifest into a ZIP on disk, then put that file in the bucket.
 *
 * Two passes rather than one overlapped stream, on purpose. The archive is
 * written in full first, so by the time the upload starts its length is
 * known — which is what lets Supabase check the size limit up front and what
 * makes a resumed upload continue from the server's offset instead of
 * regenerating and replaying. Nobody is waiting on a background job; the
 * host is emailed when it is done.
 *
 * Neither pass holds a photo in memory. Masters stream from their public URL
 * through the EXIF splice into archiver, and archiver streams into the file;
 * the upload streams the file back out in 6MB chunks.
 */

export type BuildResult = {
  /** The finished archive's size on disk. */
  bytes: number
  /** Entry names the archive is short of: masters that would not fetch. */
  missing: string[]
}

type Fetched =
  | { entry: ExportEntry; body: ReadableStream<Uint8Array> }
  | { entry: ExportEntry; body: null }

const FETCH_RETRY_DELAYS_MS = [500, 2_000]

/**
 * Fetch one master, twice more on a network error. A response that is not a
 * 2xx is not retried — the object is not there, and asking again does not
 * make it appear — and is reported as missing rather than thrown: losing one
 * photo is bad, losing the album because of one photo is worse.
 */
async function fetchMaster(entry: ExportEntry): Promise<Fetched> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(entry.url)
      if (!response.ok || !response.body) {
        await response.body?.cancel()
        return { entry, body: null }
      }
      return { entry, body: response.body }
    } catch {
      const delay = FETCH_RETRY_DELAYS_MS[attempt]
      if (delay === undefined) return { entry, body: null }
      await new Promise((r) => setTimeout(r, delay))
    }
  }
}

/**
 * Build the archive at `tmpFile`.
 *
 * Fetches run ahead of the writer with bounded concurrency, but entries are
 * appended strictly in manifest order — the numbering in the names is the
 * order the night happened in, and a reordered archive would contradict its
 * own filenames. The window advances only as archiver finishes an entry, so
 * at most `concurrency` responses are open at once and memory stays flat
 * whatever the album weighs.
 */
export async function buildArchive(
  job: ExportJob,
  tmpFile: string,
  hooks: {
    onEntry?: (done: number, total: number) => void
    concurrency?: number
  } = {},
): Promise<BuildResult> {
  const entries = job.manifest.entries
  const concurrency = Math.max(1, hooks.concurrency ?? env().fetchConcurrency)
  const missing: string[] = []

  const output = createWriteStream(tmpFile)
  const archive = archiver('zip', {
    // JPEGs are already compressed; deflating them costs CPU for nothing and
    // makes the archive's size unpredictable.
    store: true,
    zlib: { level: 0 },
  })

  const finished = new Promise<void>((resolve, reject) => {
    output.on('close', resolve)
    output.on('error', reject)
    archive.on('error', reject)
    archive.on('warning', (error) => {
      // archiver reports a missing *file* as a warning; nothing here appends
      // by path, so any warning is something to fail loudly on.
      reject(error)
    })
  })
  archive.pipe(output)

  // One promise per appended entry, resolved when archiver has fully written
  // it. Waiting on it before advancing the fetch window is what bounds the
  // number of open responses.
  const written = new Map<string, () => void>()
  archive.on('entry', (data: { name: string }) => {
    written.get(data.name)?.()
    written.delete(data.name)
  })

  function appendAndWait(
    source: Readable | string,
    name: string,
    date: Date,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      written.set(name, resolve)
      archive.append(source, { name, date })
    })
  }

  try {
    const ahead: Promise<Fetched>[] = []
    let next = 0
    const prime = () => {
      while (next < entries.length && ahead.length < concurrency) {
        ahead.push(fetchMaster(entries[next]!))
        next += 1
      }
    }
    prime()

    let done = 0
    while (ahead.length > 0) {
      const fetched = await ahead.shift()!
      const { entry } = fetched
      if (fetched.body === null) {
        missing.push(entry.name)
      } else {
        // Put the capture time back into the file itself. A ZIP entry's date
        // only becomes the modification date on extract; Photos and friends
        // read DateTimeOriginal from the bytes.
        const body = entry.exif
          ? withExifDate(
              fetched.body,
              exifDateSegmentFrom(entry.exif.stamp, entry.exif.offset),
            )
          : fetched.body
        await appendAndWait(
          Readable.fromWeb(body as import('node:stream/web').ReadableStream),
          entry.name,
          wallClockToDate(entry.lastModified),
        )
      }
      done += 1
      hooks.onEntry?.(done, entries.length)
      prime()
    }

    // Silent data loss is the thing to avoid: an archive that is short says
    // so in a file rather than just being quietly short.
    if (missing.length > 0) {
      await appendAndWait(
        missingPhotosNote(missing),
        MISSING_PHOTOS_ENTRY,
        new Date(),
      )
    }

    await archive.finalize()
    await finished
  } catch (error) {
    archive.abort()
    output.destroy()
    if (isDiskFull(error)) {
      throw new WorkerFailure('disk_full', true, 'no space left on device', {
        cause: error,
      })
    }
    if (error instanceof WorkerFailure) throw error
    throw new WorkerFailure(
      'zip_failed',
      false,
      error instanceof Error ? error.message : String(error),
      { cause: error },
    )
  }

  const { size } = await stat(tmpFile)
  return { bytes: size, missing }
}

/** Fixed by Supabase's resumable endpoint. Not a tuning knob. */
const TUS_CHUNK_BYTES = 6 * 1024 * 1024

/**
 * Upload the finished file as one resumable (TUS) upload.
 *
 * Holds nothing but the token Vercel minted for this exact object, sent as
 * `x-signature` on every request. `existingUploadUrl` is an upload a previous
 * worker started before dying; passing it back continues from the server's
 * offset, which is the whole reason the archive is a file rather than a
 * stream. The URL of a *new* upload is reported as soon as tus assigns it, so
 * the caller can persist it through heartbeat.
 */
export async function uploadArchive(
  upload: ExportUpload,
  tmpFile: string,
  hooks: {
    onUploadUrl?: (url: string) => void
    onProgress?: (sent: number, total: number) => void
  } = {},
): Promise<void> {
  const { size } = await stat(tmpFile)
  let reported: string | null = null

  await new Promise<void>((resolve, reject) => {
    const tus = new Upload(createReadStream(tmpFile), {
      endpoint: upload.endpoint,
      uploadUrl: upload.existingUploadUrl ?? undefined,
      chunkSize: TUS_CHUNK_BYTES,
      uploadSize: size,
      retryDelays: [0, 1000, 3000, 5000],
      headers: {
        apikey: upload.apikey,
        'x-signature': upload.token,
        'x-upsert': 'true',
      },
      metadata: {
        bucketName: upload.bucket,
        objectName: upload.objectPath,
        contentType: 'application/zip',
        cacheControl: '3600',
      },
      onAfterResponse() {
        // Set by tus after the creation request answers with a Location.
        if (tus.url && tus.url !== reported) {
          reported = tus.url
          hooks.onUploadUrl?.(tus.url)
        }
      },
      onProgress(sent, total) {
        hooks.onProgress?.(sent, total)
      },
      onError(error) {
        reject(
          new WorkerFailure('upload_failed', true, error.message, {
            cause: error,
          }),
        )
      },
      onSuccess() {
        resolve()
      },
    })
    tus.start()
  })
}
