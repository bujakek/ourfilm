import type { ExportManifest } from '@ourfilm/shared/export-job'

import {
  archiveEntryNames,
  sortForArchive,
  type ArchivePhoto,
} from './archive-naming'
import { eventStamp, eventUtcOffset, eventWallClockNaive } from './format'
import { publicPhotoUrl } from './photo-urls'

/**
 * The album export, as one manifest with two consumers.
 *
 * Vercel builds the manifest — every entry's public URL, its finished name in
 * the archive, the wall-clock time the file should carry, and the EXIF stamp
 * to splice back into it — because Vercel is the only side that knows what a
 * photo *is*: which guest took it, whether the host hid it, what the event's
 * zone is. Whoever then turns the manifest into bytes needs to know none of
 * that. Today that is the host's browser for a small album and the streaming
 * route for a large one; in Phase 2 of `docs/public-cdn-and-export-worker.md`
 * it is a worker on Railway. All of them produce the same archive because
 * they all start from this.
 *
 * Nothing in here may import `server-only`, React or a Supabase client: the
 * threshold and the wall-clock helper are read in the browser too.
 */

/**
 * Up to this many photos the album is zipped in the host's browser, at once.
 *
 * The number is about memory, not processing. The browser holds the finished
 * ZIP as a blob between the last byte and the save dialog, and on iOS Safari
 * that blob has a practical ceiling: Once, on the same storage with ~3.7MB
 * originals, errors out at 25 images — call it ~90MB. Twenty of our ~2MB
 * masters is ~40MB, under half of that. Larger albums are prepared elsewhere
 * and the host is told when they are ready.
 */
export const BROWSER_EXPORT_MAX_PHOTOS = 20

/**
 * The byte guard beside the count. Twenty photos from an event created before
 * September 2026 carry 4096px masters at ~4MB, which is the same blob that
 * fails on a phone; this keeps such an album on the prepared path however few
 * photos it has. `photos.byte_size` is the master alone
 * (`lib/upload-queue.ts` commits `prepared.full.size`), so the sum is an
 * honest estimate rather than a triple-count.
 */
export const BROWSER_EXPORT_MAX_BYTES = 60 * 1024 * 1024

/** What a master is assumed to weigh when a row predates `byte_size`. */
const ASSUMED_MASTER_BYTES = 3 * 1024 * 1024

export type ExportMode = 'browser' | 'prepared'

/**
 * Which path an album takes. One decision, read by the endpoint that returns
 * the manifest and by nothing else — the button asks the endpoint.
 */
export function chooseExportMode(
  photos: readonly { byte_size: number | null }[],
): ExportMode {
  if (photos.length > BROWSER_EXPORT_MAX_PHOTOS) return 'prepared'
  const bytes = photos.reduce(
    (sum, photo) => sum + (photo.byte_size ?? ASSUMED_MASTER_BYTES),
    0,
  )
  return bytes > BROWSER_EXPORT_MAX_BYTES ? 'prepared' : 'browser'
}

export type { ExportEntry, ExportManifest } from '@ourfilm/shared/export-job'
export {
  MISSING_PHOTOS_ENTRY,
  missingPhotosNote,
  wallClockToDate,
} from '@ourfilm/shared/export-job'

export type ManifestPhoto = ArchivePhoto & { storage_path: string }

/**
 * What a prepared archive was built from, as one hash.
 *
 * Over more than the photo ids: `hidden_at` decides the `rejtett/` folder,
 * `taken_at` and `created_at` decide order and stamps, the uploader name is in
 * the filename, and the zone renders every stamp. Hide a photo after an
 * export and the id set is unchanged — the hash is not, so the stale ZIP is
 * not served again. SHA-256 through Web Crypto, which both the Node server
 * and a browser have.
 */
export async function computeSourceHash(
  photos: readonly ManifestPhoto[],
  zone: string,
): Promise<string> {
  const tuple = sortForArchive(photos).map((p) => [
    p.id,
    p.hidden_at,
    p.taken_at,
    p.created_at,
    p.uploaderName,
  ])
  const bytes = new TextEncoder().encode(JSON.stringify([zone, tuple]))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('')
}

/** The sum of the masters, for the worker's disk check. Rows that predate
 *  `byte_size` count at the assumed size, so the estimate errs high. */
export function estimateArchiveBytes(
  photos: readonly { byte_size: number | null }[],
): number {
  return photos.reduce(
    (sum, photo) => sum + (photo.byte_size ?? ASSUMED_MASTER_BYTES),
    0,
  )
}

/**
 * What the export endpoint answers. Declared beside the manifest rather than
 * in the route file so the button can import the type without importing a
 * route module.
 */
export type PreparedExport = {
  exportId: string
  photoCount: number
  /** What Storage reported for the finished object; null until ready. */
  byteSize: number | null
  missingCount: number
  /** A signed download URL, only when `mode` is `ready`. */
  url: string | null
  expiresAt: string | null
}

/**
 * What the export endpoint answers.
 *
 * - `browser`: zip it here, from the manifest.
 * - `stream`: the large-album path while the worker is not switched on —
 *   navigate to `url` and the function streams the ZIP.
 * - `none`: nothing prepared yet, or the last archive is stale or gone;
 *   `POST` to request one.
 * - `queued` / `processing`: being prepared; poll.
 * - `ready`: `prepared.url` downloads it.
 * - `failed` / `expired`: the last attempt did not produce an archive that
 *   can be downloaded; `POST` to try again.
 *
 * Declared beside the manifest rather than in the route file so the button
 * can import the type without importing a route module.
 */
export type ExportResponse =
  | { mode: 'browser'; manifest: ExportManifest }
  | { mode: 'stream'; url: string; photoCount: number }
  | { mode: 'none'; photoCount: number }
  | {
      mode: 'queued' | 'processing' | 'ready' | 'failed' | 'expired'
      prepared: PreparedExport
    }

/** Order and name every photo, and resolve everything a zipper needs. */
export function buildExportManifest(
  event: { id: string; slug: string; time_zone: string },
  photos: readonly ManifestPhoto[],
): ExportManifest {
  const zone = event.time_zone
  return {
    eventId: event.id,
    filename: `${event.slug}-ourfilm.zip`,
    entries: archiveEntryNames(photos, zone).map(({ photo, name }) => ({
      id: photo.id,
      url: publicPhotoUrl(photo.storage_path),
      name,
      lastModified: eventWallClockNaive(
        photo.taken_at ?? photo.created_at,
        zone,
      ),
      exif: photo.taken_at
        ? {
            stamp: eventStamp(photo.taken_at, zone),
            offset: eventUtcOffset(photo.taken_at, zone),
          }
        : null,
    })),
  }
}
