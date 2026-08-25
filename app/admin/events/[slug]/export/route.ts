import { getOwnedEventBySlug } from '@/lib/events'
import { exifDateSegment, withExifDate } from '@/lib/exif-write'
import { eventWallClock, formatFileStamp } from '@/lib/format'
import { getAllEventPhotos, photoUploaderName } from '@/lib/photos'
import { signPhotoUrls } from '@/lib/photo-urls'
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
 * Notably this does **not** use the service-role key, which the Supabase skill
 * originally called for. That advice assumed the export had to bypass RLS. It
 * does not: the bucket is public so objects fetch without credentials, and the
 * host's own session already reads exactly their own rows. Keeping the service
 * key out of a path that streams user data is worth the sentence of
 * explanation. `getOwnedEventBySlug` returning null *is* the ownership check —
 * RLS makes "not yours" and "does not exist" the same answer.
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

  const photos = await getAllEventPhotos(event.id)
  if (photos.length === 0) {
    return new NextResponse('Ehhez az eseményhez még nincs kép', {
      status: 404,
    })
  }

  // Oldest first, so the numbering follows the order the night actually
  // happened in — which is `taken_at`, not `created_at`. Guests shoot all
  // evening and upload in a batch the next morning, so upload order would
  // number one guest's whole camera roll as if the night were theirs alone.
  // `created_at` is the fallback for photos whose file carried no EXIF.
  const when = (photo: (typeof photos)[number]) =>
    Date.parse(photo.taken_at ?? photo.created_at)
  const ordered = [...photos].sort(
    (a, b) =>
      when(a) - when(b) || Date.parse(a.created_at) - Date.parse(b.created_at),
  )
  const missing: string[] = []

  // Filenames and ZIP entry dates are rendered in the *event's* zone, not the
  // server's. Vercel runs UTC, so an event set up in Budapest would otherwise
  // name a photo taken at 14:32 as 1232.
  const zone = event.time_zone

  // The bucket is private, so every master needs a signature. Signed in one
  // batch up front rather than per entry: the entries are pulled one at a time
  // on purpose, and a round trip to Storage between each would add a whole
  // latency hop per photo to an export that already streams for minutes.
  //
  // The one-hour expiry bounds how long an export may take to *start*, not how
  // long it may run — the URLs are redeemed as each entry is pulled, and a
  // signature checked at redemption is only checked once.
  const signed = await signPhotoUrls(ordered.map((p) => p.storage_path))

  // An async generator rather than an array of promises: client-zip pulls one
  // entry at a time, so exactly one object is in flight at any moment. Kicking
  // off 500 fetches up front would open 500 connections and defeat the point of
  // streaming.
  async function* entries() {
    for (const [index, photo] of ordered.entries()) {
      const n = String(index + 1).padStart(3, '0')
      const who = `-${photoUploaderName(photo).replace(/[^\p{L}\p{N}]+/gu, '-')}`
      // Hidden photos ship too, but in their own folder: the host keeps
      // everything without a moderated shot turning up among the rest.
      const folder = photo.hidden_at ? 'rejtett/' : ''
      // The capture time goes in the name too, not only in `lastModified`: a
      // file dragged out of the folder keeps its place in the day, and the
      // couple can still tell when a shot was taken years from now.
      const stamp = photo.taken_at
        ? `-${formatFileStamp(photo.taken_at, zone)}`
        : ''
      const name = `${folder}${n}${stamp}${who}.jpg`

      const url = signed.get(photo.storage_path)
      const response = url
        ? await fetch(url)
        : new Response(null, { status: 404 })
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
