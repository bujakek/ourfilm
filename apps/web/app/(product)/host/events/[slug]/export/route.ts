import {
  buildExportManifest,
  chooseExportMode,
  type ExportResponse,
} from '@/lib/album-export'
import { getOwnedEventBySlug } from '@/lib/events'
import { getAllEventPhotos, toArchivePhoto } from '@/lib/photos'
import { reportServerIssue } from '@/lib/telemetry-server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * The host's Download, as an API: what should happen to this album?
 *
 * One JSON answer, decided here and nowhere else, so the button never has to
 * know the rules:
 *
 * - `browser` — a small album. The manifest comes back and the host's own
 *   browser fetches the masters and zips them on the spot. Nothing is queued,
 *   no row is written, and a host who shot three test photos has a file a
 *   second later.
 * - `prepared` — a large album. Today that means the streaming route at
 *   `./stream`, which the browser is sent to; in Phase 2 of
 *   `docs/public-cdn-and-export-worker.md` it becomes a queued job the host is
 *   emailed about, and this endpoint grows `queued`, `processing`, `ready` and
 *   `failed` answers without the button changing.
 *
 * No service-role key. `getOwnedEventBySlug` returning null under ownership
 * RLS *is* the ownership check — "not yours" and "does not exist" are the
 * same answer — and the manifest's URLs are public objects that need no
 * credential.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  const event = await getOwnedEventBySlug(slug)
  if (!event) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  let photos
  try {
    photos = await getAllEventPhotos(event.id)
  } catch (e) {
    await reportServerIssue(e, {
      operation: 'album_export',
      eventId: event.id,
      route: '/host/events/[slug]/export',
      routeType: 'route',
      method: 'GET',
    })
    return NextResponse.json({ error: 'unavailable' }, { status: 500 })
  }

  if (photos.length === 0) {
    return NextResponse.json({ error: 'empty' }, { status: 404 })
  }

  const body: ExportResponse =
    chooseExportMode(photos) === 'browser'
      ? {
          mode: 'browser',
          manifest: buildExportManifest(event, photos.map(toArchivePhoto)),
        }
      : {
          mode: 'prepared',
          url: `/host/events/${event.slug}/export/stream`,
          photoCount: photos.length,
        }

  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
}
