import {
  buildExportManifest,
  MISSING_PHOTOS_ENTRY,
  missingPhotosNote,
  wallClockToDate,
} from '@/lib/album-export'
import { getOwnedEventBySlug } from '@/lib/events'
import { exifDateSegmentFrom, withExifDate } from '@/lib/exif-write'
import { getAllEventPhotos, toArchivePhoto } from '@/lib/photos'
import { reportServerEvent, reportServerIssue } from '@/lib/telemetry-server'
import { downloadZip } from 'client-zip'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
// Node, not Edge: an album runs to hundreds of megabytes and Edge caps how
// long a response may stream far more tightly.
export const runtime = 'nodejs'

/**
 * Streams the whole album as a ZIP through this function.
 *
 * The large-album path for now, reached through the JSON endpoint one level
 * up, and the path Phase 2 of `docs/public-cdn-and-export-worker.md` retires:
 * on Vercel's Hobby plan a function stops at 300 seconds, and the export
 * streams at the speed of the host's connection, so a real wedding's album
 * does not fit. Until the worker exists this is what there is.
 *
 * It zips exactly what the browser would zip. The manifest in
 * `lib/album-export.ts` — order, names, wall-clock dates, EXIF stamps — is
 * shared with the browser path, so the two archives cannot drift. What
 * differs is only where the bytes go: here into a response body, there into
 * a blob.
 *
 * No service-role key. `getOwnedEventBySlug` returning null under ownership
 * RLS *is* the ownership check, and masters are public objects fetched by
 * URL. Files stream from storage straight into the archive, so memory stays
 * flat whatever the album weighs.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  const event = await getOwnedEventBySlug(slug)
  if (!event) return new NextResponse('Nincs ilyen esemény', { status: 404 })

  let photos
  try {
    photos = await getAllEventPhotos(event.id)
  } catch (e) {
    // The one failure a host sees as a broken download rather than a short
    // archive. Reported by class, like every other server failure.
    await reportServerIssue(e, {
      operation: 'album_export',
      eventId: event.id,
      route: '/host/events/[slug]/export/stream',
      routeType: 'route',
      method: 'GET',
    })
    return new NextResponse('Nem sikerült előkészíteni a letöltést', {
      status: 500,
    })
  }

  if (photos.length === 0) {
    return new NextResponse('Ehhez az eseményhez még nincs kép', {
      status: 404,
    })
  }

  const startedAt = Date.now()
  await reportServerEvent('album_export_started', {
    event_id: event.id,
    photo_count: photos.length,
  })

  const manifest = buildExportManifest(event, photos.map(toArchivePhoto))
  const hiddenCount = photos.filter((photo) => photo.hidden_at).length
  const missing: string[] = []

  // Read out here because `entries()` below is a hoisted function
  // declaration, so nothing narrowed in this scope survives into it.
  const eventId = event.id

  // An async generator rather than an array of promises: client-zip pulls one
  // entry at a time, so exactly one object is in flight at any moment. Kicking
  // off 500 fetches up front would open 500 connections and defeat the point of
  // streaming.
  async function* entries() {
    for (const entry of manifest.entries) {
      const response = await fetch(entry.url)
      if (!response.ok || !response.body) {
        // Aborting here would truncate an archive the host is already
        // downloading. Skip, and account for it at the end instead.
        missing.push(entry.name)
        continue
      }

      // Put the capture time back into the file itself. The ZIP entry date
      // below only becomes the *modification* date on extract, and Photos
      // ignores that in favour of DateTimeOriginal — so without this the whole
      // album collapses onto the day it was unzipped the moment it is
      // imported. Untouched when the capture time is unknown.
      const input = entry.exif
        ? withExifDate(
            response.body,
            exifDateSegmentFrom(entry.exif.stamp, entry.exif.offset),
          )
        : response

      yield {
        name: entry.name,
        // The wall clock the file carries on extract, in the event's zone.
        // Vercel runs UTC, so the local constructor inside `wallClockToDate`
        // is what keeps a photo taken at 14:32 from being labelled 12:32.
        lastModified: wallClockToDate(entry.lastModified),
        input,
      }
    }

    if (missing.length > 0) {
      yield {
        name: MISSING_PHOTOS_ENTRY,
        lastModified: new Date(),
        input: missingPhotosNote(missing),
      }
    }

    // The last thing the generator does, so it only fires for an export that
    // actually finished streaming. A start with no finish is a host who
    // cancelled — or a function that ran out of time on a real wedding, which
    // is the failure this pair exists to make visible.
    //
    // `missing_count` is the number worth an alert. Those photos are named in
    // a text file inside an archive nobody opens, and the couple's album is
    // short by exactly that many frames with nothing anywhere else to say so.
    await reportServerEvent('album_export_finished', {
      event_id: eventId,
      photo_count: manifest.entries.length,
      missing_count: missing.length,
      hidden_count: hiddenCount,
      elapsed_ms: Date.now() - startedAt,
    })
  }

  // No Content-Length on purpose. It would need the exact size of every
  // entry after the EXIF splice, and a Content-Length that is wrong by even
  // one byte truncates the download — a silently corrupt archive is a far
  // worse outcome than a progress bar that spins.
  return new NextResponse(downloadZip(entries()).body, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${manifest.filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
