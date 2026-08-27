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
 * Five minutes, set here rather than left to whatever the platform defaults to.
 *
 * This is one invocation that streams every photo in the album through itself,
 * so its wall clock scales with the album rather than with the work per
 * request: a few hundred photos at a couple of megabytes each is minutes. A
 * default chosen for ordinary requests is not chosen with that in mind, and
 * running out mid-stream is the one failure this route cannot report — the 200
 * and the headers left before the first byte did, so the host is handed a
 * truncated ZIP that looks like a completed download.
 *
 * 300 is the ceiling on Vercel's Hobby plan; Pro allows up to 800. Raise it
 * only together with checking which plan this project is on — a `maxDuration`
 * above the plan's limit fails the deployment rather than being clamped down.
 */
export const maxDuration = 300

/**
 * How many photos to fetch ahead of the one client-zip is currently writing.
 *
 * A ZIP is strictly sequential — entry N's bytes have to be written before
 * N+1's — so this parallelises nothing about the archive itself. What it
 * removes is the dead time in front of each entry: one round trip to Storage
 * per photo that used to be spent with nothing else in flight. Worth a few
 * seconds per hundred photos, not an order of magnitude; the bulk of an export
 * is bytes on the wire, and those are still strictly serialised.
 *
 * Deliberately small. The comment this replaces warned against kicking off 500
 * fetches up front and it was right to: a prefetched body is not read until
 * client-zip pulls it, so each one parks a connection with its receive buffer
 * held open, and on a slow client that is a stall measured in minutes. Four
 * keeps the pipe full and stays bounded whatever the album weighs.
 */
const PREFETCH = 4

/** What client-zip is handed as an entry's contents: the rewritten stream when
 *  a capture time went back into the header, the untouched response when not. */
type ExportInput = ReadableStream<Uint8Array> | Response

/** Throw away a prepared entry's body without reading it, for the ones still
 *  in the window when an export is abandoned. `cancel` propagates through
 *  `withExifDate`, which delegates to the reader it took. */
function release(
  prepared: { entry: { input: ExportInput } } | { missing: string },
): void {
  if (!('entry' in prepared)) return
  const { input } = prepared.entry
  const body = input instanceof Response ? input.body : input
  void body?.cancel().catch(() => {})
}

/**
 * Streams the whole album as a ZIP — the "download everything" the landing page
 * promises the couple.
 *
 * Two access checks doing different jobs. `getOwnedEventBySlug` returning null
 * *is* the ownership check: it reads through the host's own session, so RLS
 * makes "not yours" and "does not exist" the same answer. Only once that has
 * passed does `signPhotoUrls` mint read URLs with the service-role key — the
 * bucket is private, nothing here can fetch an object without a signature, and
 * the service role is what makes one. The privilege is real, so it is reached
 * only after the caller has been proven to own the event.
 *
 * This block used to claim the opposite on both counts — no service-role key,
 * and a public bucket. Both were true before the bucket was made private and
 * neither has been since; it is noted because the stale version read as a
 * deliberate security property rather than an out-of-date sentence.
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
  // batch up front rather than per entry: a round trip to Storage between each
  // would add a whole latency hop per photo to an export that already streams
  // for minutes.
  //
  // The one-hour expiry bounds how long an export may take to *start*, not how
  // long it may run — the URLs are redeemed as each entry is pulled, and a
  // signature checked at redemption is only checked once.
  const signed = await signPhotoUrls(ordered.map((p) => p.storage_path))

  /** One entry's worth of work: either something to put in the ZIP, or the
   *  note that it could not be fetched. Resolved ahead of the writer, so it
   *  carries the failure rather than throwing it at whoever awaits it. */
  type Prepared =
    | { entry: { name: string; lastModified: Date; input: ExportInput } }
    | { missing: string }

  /**
   * Fetch one photo and dress it as a ZIP entry.
   *
   * Runs ahead of the writer, which is why nothing in here throws: a rejection
   * from a prefetched promise has nothing awaiting it at the moment it
   * happens, and would surface as an unhandled rejection rather than as a
   * skipped photo. Every failure becomes a `missing` line instead — the same
   * policy the sequential version applied to a non-OK response, now applied to
   * a refused connection too.
   */
  async function prepare(
    photo: (typeof ordered)[number],
    index: number,
  ): Promise<Prepared> {
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
    const absent = { missing: `${name} (${photo.storage_path})` }

    const url = signed.get(photo.storage_path)
    if (!url) return absent

    let response: Response
    try {
      response = await fetch(url)
    } catch {
      // Aborting here would truncate an archive the host is already
      // downloading. Skip, and account for it at the end instead.
      return absent
    }
    if (!response.ok || !response.body) return absent

    // Put the capture time back into the file itself. The ZIP entry date
    // below only becomes the *modification* date on extract, and Photos
    // ignores that in favour of DateTimeOriginal — so without this the whole
    // album collapses onto the day it was unzipped the moment it is
    // imported. Untouched when the capture time is unknown.
    const input = photo.taken_at
      ? withExifDate(response.body, exifDateSegment(photo.taken_at, zone))
      : response

    return {
      entry: {
        name,
        // The date the file carries on extract. Upload time here would stamp
        // every photo in the album with the morning someone got round to it,
        // and a bare `new Date` would render it in the server's zone — UTC on
        // Vercel — rather than the event's.
        lastModified: eventWallClock(photo.taken_at ?? photo.created_at, zone),
        input,
      },
    }
  }

  // An async generator rather than an array of promises: client-zip pulls one
  // entry at a time, and a window of `PREFETCH` requests is the whole point —
  // enough in flight to hide the latency in front of the next photo, few
  // enough that the connections stay counted on one hand.
  async function* entries() {
    /** The look-ahead window, in album order. Shifted from the front and
     *  refilled from the back, so `missing` is still accumulated in the order
     *  the photos appear rather than the order their fetches happened to
     *  finish. */
    const window: Promise<Prepared>[] = []
    let next = 0

    const fill = () => {
      while (window.length < PREFETCH && next < ordered.length) {
        window.push(prepare(ordered[next], next))
        next += 1
      }
    }

    try {
      fill()
      while (window.length > 0) {
        const prepared = await window.shift()!
        // Refilled only after one leaves, so exactly PREFETCH requests are
        // ever open at once.
        fill()

        if ('missing' in prepared) missing.push(prepared.missing)
        else yield prepared.entry
      }

      // Silent data loss is the thing to avoid: if anything was skipped, the
      // ZIP says so rather than just being quietly short.
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
    } finally {
      // The host closing the tab stops the consumer pulling, and whatever was
      // fetched ahead is then holding open connections nobody will read.
      // Release them rather than leaving it to a garbage collector.
      //
      // Only reached if the consumer actually closes this generator, which
      // client-zip does not currently do — it iterates with `for await` over a
      // wrapper that has no `return`. Cheap insurance either way, and correct
      // on the ordinary path where the loop simply ends.
      for (const pending of window) void pending.then(release, () => {})
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
