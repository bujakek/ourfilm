import { archiveEntryNames, type ArchivePhoto } from './archive-naming'
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

export type ExportEntry = {
  /** The photo id, for telemetry and for matching a failure back to a row. */
  id: string
  /** The master's public URL. No credential is needed to fetch it. */
  url: string
  /** The entry's full name inside the archive, `rejtett/` prefix included. */
  name: string
  /**
   * The modification time the extracted file should carry, as a naive
   * `YYYY-MM-DDTHH:mm:ss` in the event's zone. Naive on purpose: a ZIP stores
   * DOS time with no zone, so what has to travel is the wall clock, and an
   * instant would be shifted by whatever zone the consumer happens to run in.
   * Turn it back into a `Date` with `wallClockToDate`.
   */
  lastModified: string
  /** The EXIF capture time to splice in, or null when the file carried none. */
  exif: { stamp: string; offset: string } | null
}

export type ExportManifest = {
  eventId: string
  /** The download's filename, `<slug>-ourfilm.zip`. */
  filename: string
  entries: ExportEntry[]
}

export type ManifestPhoto = ArchivePhoto & { storage_path: string }

/**
 * What the export endpoint answers. Declared beside the manifest rather than
 * in the route file so the button can import the type without importing a
 * route module.
 */
export type ExportResponse =
  | { mode: 'browser'; manifest: ExportManifest }
  | { mode: 'prepared'; url: string; photoCount: number }

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

/**
 * A naive wall-clock string back into a `Date` whose *local* components are
 * that wall clock — which is what a ZIP writer reads. Built with the local
 * constructor, never by parsing an ISO string, because the parse would fix an
 * instant and the local components would then depend on the machine's zone.
 */
export function wallClockToDate(naive: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(naive)
  if (!m) throw new Error(`Not a wall-clock timestamp: ${naive}`)
  const [, y, mo, d, h, mi, s] = m
  return new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s),
  )
}

/** The name of the note that lists photos the archive is short of. */
export const MISSING_PHOTOS_ENTRY = 'HIANYZO-KEPEK.txt'

/**
 * Silent data loss is the thing to avoid: an archive that is short says so in
 * a file rather than just being quietly short. The same note whoever built
 * the archive, so the host reads one sentence, not two.
 */
export function missingPhotosNote(names: readonly string[]): string {
  return (
    'Ezeket a képeket nem sikerült letölteni a tárhelyről:\n\n' +
    names.join('\n') +
    '\n'
  )
}
