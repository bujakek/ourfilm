import 'server-only'

import type { ExportJob } from '@ourfilm/shared/export-job'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  buildExportManifest,
  computeSourceHash,
  estimateArchiveBytes,
  type PreparedExport,
} from '../album-export'
import { HOST_PHOTO_COLUMNS, toArchivePhoto, type HostPhoto } from '../photos'
import { EXPORT_BUCKET, exportStoragePath } from '../storage'
import type { Database } from '../supabase/database.types'
import { publicSupabaseEnv } from '../supabase/env'

/**
 * The prepared-export job, from the web side.
 *
 * Everything here runs with the service role, after the caller has already
 * decided the request is legitimate: the host's page checks ownership under
 * RLS before it calls in, and the worker's endpoints check the shared secret.
 * `album_exports` has no policies at all, so this is the only way in.
 */

export type AlbumExportRow =
  Database['public']['Tables']['album_exports']['Row']
type Db = SupabaseClient<Database>

/** How long a claim is held. A heartbeat every minute keeps it alive; ten
 *  minutes with no heartbeat is a dead worker. */
export const EXPORT_LEASE_SECONDS = 600
export const EXPORT_HEARTBEAT_SECONDS = 60
const LEASE = `${EXPORT_LEASE_SECONDS} seconds`

export type ExportEvent = {
  id: string
  slug: string
  event_name: string
  time_zone: string
  locale: string
  owner_id: string
}

export async function loadExportEvent(
  db: Db,
  eventId: string,
): Promise<ExportEvent | null> {
  const { data, error } = await db
    .from('events')
    .select('id, slug, event_name, time_zone, locale, owner_id')
    .eq('id', eventId)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Exactly what the host's page reads, so the archive the worker builds is
 *  the one the host saw — hidden photos included, in `rejtett/`. */
export async function loadExportPhotos(
  db: Db,
  eventId: string,
): Promise<HostPhoto[]> {
  const { data, error } = await db
    .from('photos')
    .select(HOST_PHOTO_COLUMNS)
    .eq('event_id', eventId)
    .eq('status', 'ready')
    // A deleted photo's row survives so its frame stays spent, but its three
    // objects are gone. Without this the worker would chase three 404s and
    // report the album short by one, which is the number CLAUDE.md wants an
    // alert on — a false alarm on every event a host has tidied.
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** The three numbers a request carries, from the rows as they stand now. */
export async function describeAlbum(
  photos: readonly HostPhoto[],
  zone: string,
): Promise<{ sourceHash: string; photoCount: number; estimatedBytes: number }> {
  return {
    sourceHash: await computeSourceHash(photos.map(toArchivePhoto), zone),
    photoCount: photos.length,
    estimatedBytes: estimateArchiveBytes(photos),
  }
}

export async function requestExport(
  db: Db,
  eventId: string,
  album: { sourceHash: string; photoCount: number; estimatedBytes: number },
): Promise<AlbumExportRow> {
  // A composite-returning RPC arrives as the object itself; `.single()`
  // would narrow the type to `never`.
  const { data, error } = await db.rpc('request_album_export', {
    p_event_id: eventId,
    p_source_hash: album.sourceHash,
    p_photo_count: album.photoCount,
    p_estimated_bytes: album.estimatedBytes,
  })
  if (error) throw error
  return data
}

export async function exportStatus(
  db: Db,
  eventId: string,
): Promise<AlbumExportRow | null> {
  const { data, error } = await db.rpc('album_export_status', {
    p_event_id: eventId,
  })
  if (error) throw error
  // A `returns <table>` function with no match comes back as a row of nulls.
  return data?.id ? data : null
}

/** A ready row is only worth offering while its object exists and its hash
 *  still describes the album. Anything else is `none` to the host: prepare
 *  it again. */
export function readyForDownload(
  row: AlbumExportRow,
  sourceHash: string,
): boolean {
  return (
    row.status === 'ready' &&
    row.storage_path !== null &&
    row.source_hash === sourceHash &&
    row.expires_at !== null &&
    Date.parse(row.expires_at) > Date.now()
  )
}

/**
 * The download link, minted fresh each time the host's page asks. Bounded by
 * the export's own expiry so a link cannot outlive the object, and named so
 * the host receives `<slug>-ourfilm.zip` rather than a uuid.
 */
export async function signedDownloadUrl(
  db: Db,
  row: AlbumExportRow,
  filename: string,
): Promise<string | null> {
  if (!row.storage_path || !row.expires_at) return null
  const remaining = Math.floor((Date.parse(row.expires_at) - Date.now()) / 1000)
  const ttl = Math.max(60, Math.min(remaining, 60 * 60))
  const { data, error } = await db.storage
    .from(EXPORT_BUCKET)
    .createSignedUrl(row.storage_path, ttl, { download: filename })
  if (error) throw error
  return data.signedUrl
}

export async function describePrepared(
  db: Db,
  row: AlbumExportRow,
  filename: string,
): Promise<PreparedExport> {
  return {
    exportId: row.id,
    photoCount: row.photo_count,
    byteSize: row.byte_size,
    missingCount: row.missing_count,
    url:
      row.status === 'ready'
        ? await signedDownloadUrl(db, row, filename)
        : null,
    expiresAt: row.expires_at,
  }
}

/**
 * What Storage holds at a path, in bytes — or null when nothing does.
 *
 * Read at completion instead of trusting the worker's word: a worker that
 * died mid-upload and retried `complete` cannot talk a half-written archive
 * into `ready`, because a resumable upload that has not received its last
 * chunk is not an object yet.
 */
export async function storedObjectSize(
  db: Db,
  path: string,
): Promise<number | null> {
  const slash = path.lastIndexOf('/')
  const folder = path.slice(0, slash)
  const name = path.slice(slash + 1)
  const { data, error } = await db.storage
    .from(EXPORT_BUCKET)
    .list(folder, { search: name, limit: 10 })
  if (error) throw error
  const object = data?.find((o) => o.name === name)
  const size = object?.metadata?.size
  return typeof size === 'number' ? size : null
}

/**
 * The resumable upload endpoint, on the direct storage hostname where one
 * exists: Supabase recommends it for large files, and the project URL's edge
 * is not where a 4GB archive should be proxied through.
 */
export function resumableUploadEndpoint(): string {
  const override = process.env.SUPABASE_STORAGE_URL
  const { url } = publicSupabaseEnv()
  const base =
    override?.replace(/\/$/, '') ??
    url.replace(
      /^https:\/\/([a-z0-9-]+)\.supabase\.co$/,
      'https://$1.storage.supabase.co',
    )
  return `${base}/storage/v1/upload/resumable/sign`
}

/**
 * The job as the worker receives it: the manifest, one upload it was handed a
 * token for, and the lease's timing. Built after the claim, from the rows as
 * they stand now, so a photo hidden between request and claim is filed in
 * `rejtett/` and not among the rest.
 */
export async function buildExportJob(
  db: Db,
  row: AlbumExportRow,
): Promise<ExportJob | null> {
  const event = await loadExportEvent(db, row.event_id)
  if (!event) return null
  const photos = await loadExportPhotos(db, row.event_id)
  if (photos.length === 0) return null

  const manifest = buildExportManifest(event, photos.map(toArchivePhoto))
  const objectPath = exportStoragePath(event.id, row.id)
  const { data: signed, error } = await db.storage
    .from(EXPORT_BUCKET)
    .createSignedUploadUrl(objectPath, { upsert: true })
  if (error) throw error

  return {
    exportId: row.id,
    manifest,
    estimatedBytes: estimateArchiveBytes(photos),
    upload: {
      endpoint: resumableUploadEndpoint(),
      apikey: publicSupabaseEnv().anonKey,
      token: signed.token,
      bucket: EXPORT_BUCKET,
      objectPath,
      existingUploadUrl: row.tus_upload_url,
    },
    leaseSeconds: EXPORT_LEASE_SECONDS,
    heartbeatSeconds: EXPORT_HEARTBEAT_SECONDS,
  }
}

export const LEASE_INTERVAL = LEASE
