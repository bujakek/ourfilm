import 'server-only'

import {
  BROWSER_EXPORT_MAX_PHOTOS,
  buildExportManifest,
  chooseExportMode,
  type ExportResponse,
} from '../album-export'
import type { OwnedEvent } from '../events'
import { toArchivePhoto, type HostPhoto } from '../photos'
import { createAdminClient } from '../supabase/admin'
import { reportServerEvent } from '../telemetry-server'
import {
  describeAlbum,
  describePrepared,
  exportStatus,
  readyForDownload,
  requestExport,
  type AlbumExportRow,
} from './jobs'
import { exportWorkerEnabled } from './worker-auth'

/**
 * What should happen to this album — the one decision the export endpoint
 * and the host's page both need, so it is made here and nowhere else.
 *
 * `exportAnswer` reads; `requestAnswer` asks for an archive first, which the
 * database dedupes against one in flight and against a ready one built from
 * the same `source_hash`. Both assume the caller has already established
 * ownership: everything below the browser branch runs with the service role.
 */

type Album = Pick<OwnedEvent, 'id' | 'slug' | 'time_zone'>

async function preparedAnswer(
  event: Album,
  photos: readonly HostPhoto[],
  row: AlbumExportRow | null,
  sourceHash: string,
): Promise<ExportResponse> {
  if (!row) return { mode: 'none', photoCount: photos.length }
  const db = createAdminClient()
  const filename = `${event.slug}-ourfilm.zip`
  if (row.status === 'queued' || row.status === 'processing') {
    return {
      mode: row.status,
      prepared: await describePrepared(db, row, filename),
    }
  }
  if (row.status === 'ready') {
    if (readyForDownload(row, sourceHash)) {
      return {
        mode: 'ready',
        prepared: await describePrepared(db, row, filename),
      }
    }
    // Built from an album that has since changed, or past its window with the
    // sweep not yet round: to the host, nothing is prepared.
    return { mode: 'none', photoCount: photos.length }
  }
  return {
    mode: row.status === 'failed' ? 'failed' : 'expired',
    prepared: await describePrepared(db, row, filename),
  }
}

export async function exportAnswer(
  event: Album,
  photos: readonly HostPhoto[],
): Promise<ExportResponse> {
  if (chooseExportMode(photos) === 'browser') {
    return {
      mode: 'browser',
      manifest: buildExportManifest(event, photos.map(toArchivePhoto)),
    }
  }
  if (!exportWorkerEnabled()) {
    return {
      mode: 'stream',
      url: `/host/events/${event.slug}/export/stream`,
      photoCount: photos.length,
    }
  }
  const db = createAdminClient()
  const [{ sourceHash }, row] = await Promise.all([
    describeAlbum(photos, event.time_zone),
    exportStatus(db, event.id),
  ])
  return preparedAnswer(event, photos, row, sourceHash)
}

export async function requestAnswer(
  event: Album,
  photos: readonly HostPhoto[],
): Promise<ExportResponse> {
  if (chooseExportMode(photos) === 'browser' || !exportWorkerEnabled()) {
    return exportAnswer(event, photos)
  }
  const db = createAdminClient()
  const album = await describeAlbum(photos, event.time_zone)
  const row = await requestExport(db, event.id, album)
  if (row.status === 'queued' && row.attempt_count === 0) {
    await reportServerEvent('album_export_queued', {
      event_id: event.id,
      photo_count: album.photoCount,
      estimated_bytes: album.estimatedBytes,
    })
  }
  return preparedAnswer(event, photos, row, album.sourceHash)
}

/** The sentence under the Album button, when there is something to say. */
export function exportNote(
  photoCount: number,
  locale: 'en' | 'hu',
): string | null {
  if (!exportWorkerEnabled()) return null
  if (photoCount <= BROWSER_EXPORT_MAX_PHOTOS) return null
  return locale === 'en'
    ? 'Up to 20 photos the album downloads at once. Larger albums are prepared, and we email you when they are ready to download.'
    : 'Legfeljebb 20 képig az album azonnal letöltődik. Nagyobb albumot előkészítünk, és e-mailben szólunk, amikor letölthető.'
}
