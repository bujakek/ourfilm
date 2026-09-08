import { getOwnedEventBySlug } from '@/lib/events'
import { exportAnswer, requestAnswer } from '@/lib/exports/answer'
import type { ExportResponse } from '@/lib/album-export'
import { getAllEventPhotos, type HostPhoto } from '@/lib/photos'
import { reportServerIssue } from '@/lib/telemetry-server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * The host's Download, as an API: what should happen to this album?
 *
 * One JSON answer (`lib/exports/answer.ts`), decided in one place, so the
 * button never has to know the rules:
 *
 * - `browser` — a small album. The manifest comes back and the host's own
 *   browser fetches the masters and zips them on the spot. Nothing is queued,
 *   no row is written, and a host who shot three test photos has a file a
 *   second later.
 * - `stream` — a large album while the worker is switched off: the browser is
 *   sent to `./stream` and a function streams the ZIP. The cutover switch is
 *   `OURFILM_EXPORT_WORKER`.
 * - `none` / `queued` / `processing` / `ready` / `failed` / `expired` — a
 *   large album with the worker on. `GET` only reads; `POST` asks for an
 *   archive, which the database dedupes against one already in flight and
 *   against a ready one built from the same `source_hash`. The button polls
 *   `GET` while a job is in flight, and `ready` carries a fresh signed URL.
 *
 * Ownership is checked under RLS by `getOwnedEventBySlug` returning null;
 * only after that does anything touch `album_exports`, which has no policies
 * and is reached with the service role.
 */
type Loaded = {
  event: NonNullable<Awaited<ReturnType<typeof getOwnedEventBySlug>>>
  photos: HostPhoto[]
}

async function load(
  slug: string,
  method: 'GET' | 'POST',
): Promise<Loaded | NextResponse> {
  const event = await getOwnedEventBySlug(slug)
  if (!event) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  let photos: HostPhoto[]
  try {
    photos = await getAllEventPhotos(event.id)
  } catch (e) {
    await reportServerIssue(e, {
      operation: 'album_export',
      eventId: event.id,
      route: '/host/events/[slug]/export',
      routeType: 'route',
      method,
    })
    return NextResponse.json({ error: 'unavailable' }, { status: 500 })
  }
  if (photos.length === 0) {
    return NextResponse.json({ error: 'empty' }, { status: 404 })
  }
  return { event, photos }
}

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } }

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const loaded = await load(slug, 'GET')
  if (loaded instanceof NextResponse) return loaded
  return answer(() => exportAnswer(loaded.event, loaded.photos), loaded, 'GET')
}

/** One JSON answer or one reported 500 — never an unhandled throw that the
 *  button has to interpret from a Next error page. */
async function answer(
  produce: () => Promise<ExportResponse>,
  loaded: Loaded,
  method: 'GET' | 'POST',
) {
  try {
    return NextResponse.json(await produce(), NO_STORE)
  } catch (e) {
    await reportServerIssue(e, {
      operation: 'album_export_answer',
      eventId: loaded.event.id,
      route: '/host/events/[slug]/export',
      routeType: 'route',
      method,
    })
    return NextResponse.json({ error: 'unavailable' }, { status: 500 })
  }
}

/** Ask for an archive. Idempotent: a job in flight or a matching ready
 *  archive is returned rather than duplicated. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const loaded = await load(slug, 'POST')
  if (loaded instanceof NextResponse) return loaded
  return answer(
    () => requestAnswer(loaded.event, loaded.photos),
    loaded,
    'POST',
  )
}
