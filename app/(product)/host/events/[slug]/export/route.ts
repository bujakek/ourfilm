import { archiveEntryNames } from '@/lib/archive-naming'
import { getOwnedEventBySlug } from '@/lib/events'
import { exifDateSegment, withExifDate } from '@/lib/exif-write'
import { eventWallClock } from '@/lib/format'
import { getAllEventPhotos, toArchivePhoto } from '@/lib/photos'
import { publicPhotoUrl } from '@/lib/photo-urls'
import { reportServerEvent, reportServerIssue } from '@/lib/telemetry-server'
import { downloadZip } from 'client-zip'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
// Node, not Edge: an album runs to hundreds of megabytes and Edge caps how
// long a response may stream far more tightly.
export const runtime = 'nodejs'

/**
 * Streams the whole album as a ZIP — the "download everything" the landing page
 * promises the couple.
 *
 * No service-role key anywhere in this path. The rows come off the host's own
 * session under ownership RLS, so `getOwnedEventBySlug` returning null *is*
 * the ownership check — "not yours" and "does not exist" are the same answer.
 * The bytes come off the public bucket by URL, so fetching a master needs no
 * credential either. Keeping the service key out of a route that streams user
 * data is worth the sentence.
 *
 * Entry order and names are `lib/archive-naming.ts`, pinned by a golden
 * fixture, so a second runtime producing this archive cannot drift from it.
 *
 * Files stream from storage straight into the archive, so memory stays flat
 * whatever the album weighs. Buffering it (JSZip and friends) would run a
 * serverless function out of memory on a real wedding.
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
      route: '/host/events/[slug]/export',
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

  // Filenames and ZIP entry dates are rendered in the *event's* zone, not the
  // server's. Vercel runs UTC, so an event set up in Budapest would otherwise
  // name a photo taken at 14:32 as 1232.
  const zone = event.time_zone

  // Ordering and naming live in `lib/archive-naming.ts`; see there for why the
  // album is numbered by `taken_at` rather than upload order.
  const ordered = archiveEntryNames(photos.map(toArchivePhoto), zone)
  const missing: string[] = []

  // Read out here for the same reason `zone` is: `entries()` below is a
  // hoisted function declaration, so nothing narrowed in this scope survives
  // into it.
  const eventId = event.id

  // An async generator rather than an array of promises: client-zip pulls one
  // entry at a time, so exactly one object is in flight at any moment. Kicking
  // off 500 fetches up front would open 500 connections and defeat the point of
  // streaming.
  async function* entries() {
    for (const { photo, name } of ordered) {
      // A public URL is a pure function of the path — no signature to mint up
      // front, nothing that can expire while a long export is still running.
      const response = await fetch(publicPhotoUrl(photo.storage_path))
      if (!response.ok || !response.body) {
        // Aborting here would truncate an archive the host is already
        // downloading. Skip, and account for it at the end instead.
        missing.push(`${name} (${photo.storage_path})`)
        continue
      }

      // Put the capture time back into the file itself. The ZIP entry date
      // below only becomes the *modification* date on extract, and Photos
      // ignores that in favour of DateTimeOriginal — so without this the whole
      // album collapses onto the day it was unzipped the moment it is
      // imported. Untouched when the capture time is unknown.
      const input =
        photo.taken_at && response.body
          ? withExifDate(response.body, exifDateSegment(photo.taken_at, zone))
          : response

      yield {
        name,
        // The date the file carries on extract. Upload time here would stamp
        // every photo in the album with the morning someone got round to it,
        // and a bare `new Date` would render it in the server's zone — UTC on
        // Vercel — rather than the event's.
        lastModified: eventWallClock(photo.taken_at ?? photo.created_at, zone),
        input,
      }
    }

    // Silent data loss is the thing to avoid: if anything was skipped, the ZIP
    // says so rather than just being quietly short.
    if (missing.length > 0) {
      yield {
        name: 'HIANYZO-KEPEK.txt',
        lastModified: new Date(),
        input:
          'Ezeket a képeket nem sikerült letölteni a tárhelyről:\n\n' +
          missing.join('\n') +
          '\n',
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
      photo_count: ordered.length,
      missing_count: missing.length,
      hidden_count: ordered.filter(({ photo }) => photo.hidden_at).length,
      elapsed_ms: Date.now() - startedAt,
    })
  }

  // No Content-Length on purpose. It would need the exact compressed size of
  // every entry, and `byte_size` is what the browser reported at upload rather
  // than a measurement of the stored object. A Content-Length that is wrong by
  // even one byte truncates the download — a silently corrupt archive is a far
  // worse outcome than a progress bar that spins.
  return new NextResponse(downloadZip(entries()).body, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${event.slug}-ourfilm.zip"`,
      'Cache-Control': 'no-store',
    },
  })
}
