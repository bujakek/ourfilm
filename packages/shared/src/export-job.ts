/**
 * The contract between the web app and whoever turns an album into a ZIP.
 *
 * Three consumers read a manifest — the host's browser for a small album, the
 * streaming route for now, and the export worker on Railway — and none of
 * them may know what a photo *is*. So every entry arrives finished: a public
 * URL, the name it takes inside the archive (`rejtett/` prefix included), the
 * wall-clock time the extracted file should carry, and the EXIF stamp to
 * splice back in, already rendered in the event's zone. Ordering, naming,
 * moderation and zones are decided on the web side, once, and this file is
 * only the shape they arrive in.
 *
 * Nothing here may reach for Node, React or a Supabase client: it is imported
 * by a browser bundle as well as a worker process.
 */

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

/**
 * One export job, as the worker receives it from `POST /api/exports/claim`.
 *
 * Everything the worker needs and nothing it could misuse: the manifest, one
 * upload it was handed a token for, and the timing of the lease it holds. No
 * ids beyond the job's own, no Supabase key, no database.
 */
export type ExportJob = {
  exportId: string
  manifest: ExportManifest
  /** The sum of the masters' sizes, for the disk check before any write. */
  estimatedBytes: number
  upload: ExportUpload
  /** How long the claim is held before the job may be re-claimed. */
  leaseSeconds: number
  /** How often to call heartbeat; well inside the lease. */
  heartbeatSeconds: number
}

/**
 * Where the finished archive goes, and the one credential that lets it.
 *
 * `token` is a Supabase signed upload token, minted on the web side for
 * exactly `bucket/objectPath` and nothing else; it travels in the
 * `x-signature` header of every request to `endpoint`. `apikey` is the
 * project's public anon key, which the resumable endpoint requires as a
 * routing header and which is already in every browser bundle.
 */
export type ExportUpload = {
  /** `https://<project>.storage.supabase.co/storage/v1/upload/resumable/sign` */
  endpoint: string
  apikey: string
  token: string
  bucket: string
  objectPath: string
  /**
   * A resumable upload this job already started, if a previous worker
   * reported one through heartbeat and then died. Pass it as `uploadUrl` to
   * continue from the server's offset instead of creating a new upload.
   */
  existingUploadUrl: string | null
}

/** Why a job failed, in the words the retry policy understands. */
export type ExportFailureCode =
  | 'disk_full'
  | 'fetch_failed'
  | 'zip_failed'
  | 'upload_failed'
  | 'lease_lost'
  | 'unknown'

export type ClaimResponse = { job: ExportJob } | { job: null }

export type HeartbeatRequest = { tusUploadUrl?: string | null }
export type HeartbeatResponse = { ok: true } | { ok: false; reason: string }

export type CompleteResponse = { ok: true } | { ok: false; reason: string }

export type FailRequest = {
  code: ExportFailureCode
  /** Whether the failure looks transient. The server owns the attempt budget. */
  retry: boolean
  detail?: string
}
