import 'server-only'

import { cache } from 'react'

import { archiveEntryName, type ArchivePhoto } from './archive-naming'
import { publicPhotoDownloadUrl, publicPhotoUrl } from './photo-urls'
import { createClient } from './supabase/server'
import type { Database } from './supabase/database.types'

/**
 * A photo as a guest sees it.
 *
 * `uploader_name` is the participant's display name, joined in by the RPC. It
 * used to be a free-text column on the photo itself — a label, never an
 * identity — and two guests typing the same name were indistinguishable. Now it
 * comes off the participant row, so a name in the gallery is the same person
 * whose roll of film that frame came out of.
 */
export type GalleryPhoto =
  Database['public']['Functions']['event_gallery_by_slug']['Returns'][number]

/**
 * The guest gallery for one event.
 *
 * The reveal check lives in the RPC's `where` clause, not here. That is the
 * whole reason this is still a `security definer` function reachable by `anon`:
 * a guest calling it directly before the reveal gets zero rows, which is the
 * same answer the page gives and the only one that survives the caller being
 * curl. Pending captures are excluded too — a frame whose bytes are still
 * uploading is not in the album yet.
 */
export async function getGalleryPhotosBySlug(
  slug: string,
): Promise<GalleryPhoto[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('event_gallery_by_slug', {
    p_slug: slug,
  })

  if (error) throw error
  return data ?? []
}

/** The columns a host-side read needs, shared with the export job's loader so
 *  the archive built by the worker sees exactly what the host's page saw. */
export const HOST_PHOTO_COLUMNS =
  'id, storage_path, thumb_path, view_path, hidden_at, width, height, created_at, taken_at, byte_size, participant_id, participants(display_name)'

export type HostPhoto = {
  id: string
  storage_path: string
  thumb_path: string
  view_path: string | null
  hidden_at: string | null
  width: number | null
  height: number | null
  created_at: string
  taken_at: string | null
  /** The master's size, as committed by the uploader; null on early rows. */
  byte_size: number | null
  participant_id: string
  participants: { display_name: string } | null
}

/**
 * Every photo in an event, for the host.
 *
 * Reads the table rather than the guest RPC, deliberately: moderation needs to
 * see exactly what the RPC exists to hide — hidden photos, and everything
 * before the reveal. RLS scopes it to events the caller owns.
 *
 * Filters to `ready`. A reserved-but-uncommitted frame has no bytes behind it,
 * so showing it to a host would be a permanently broken tile in their grid.
 *
 * And to `deleted_at is null`. A deleted photo keeps its row — that is what
 * keeps the frame spent, see the column's own comment — but its three storage
 * objects are gone, so every surface that would render or fetch it has to stop
 * at the query. This one and `loadExportPhotos` are the only two that read the
 * table directly; every RPC is already covered by the `hidden_at` a delete
 * sets.
 */
export const getAllEventPhotos = cache(
  async (eventId: string): Promise<HostPhoto[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('photos')
      .select(HOST_PHOTO_COLUMNS)
      .eq('event_id', eventId)
      .eq('status', 'ready')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  },
)

export type EventCaptureHealth = {
  /** Reservations young enough to still be a normal in-flight upload. */
  uploading: number
  /** Reservations old enough that the device probably stopped or is retrying. */
  stalled: number
}

const STALLED_CAPTURE_MS = 3 * 60 * 1000

/**
 * Past this, no device is still trying, so the row is not news.
 *
 * Mirrors `MAX_AGE_MS` in `lib/upload-queue.ts`, which is where a shot is
 * finally dropped — mirrored rather than imported, the way
 * `FREE_PARTICIPANT_LIMIT` mirrors its database function, because that module
 * reaches for IndexedDB at import time and this one runs on the server.
 */
const ABANDONED_CAPTURE_MS = 24 * 60 * 60 * 1000

/**
 * What the server can honestly tell the host about unfinished captures.
 *
 * A photo waiting only in a guest's IndexedDB is necessarily invisible here.
 * Once `reserve_shot` has reached the server, however, its pending row remains
 * until commit or release. Three minutes covers the normal 120-second upload
 * timeout plus preparation and both short RPCs; older rows are unusually slow
 * or were interrupted. RLS keeps this read scoped to the event's owner.
 *
 * **Both bounds are load-bearing, and the upper one is the subtle half.** A
 * `pending` row is never swept: `shot_reservation_ttl()` only stops it
 * *counting* against the guest's roll, and `release_shot` fires solely when a
 * guest's own page is still open to call it. So every reservation ever
 * abandoned is still in the table, and counting all of them would tell the
 * host of a week-old wedding that forty uploads are in trouble and a phone
 * might still retry — when the queue gave each of them up after a day. Older
 * than `ABANDONED_CAPTURE_MS` is history, not a live upload, and this says
 * nothing about it.
 */
export async function getEventCaptureHealth(
  eventId: string,
  now = Date.now(),
): Promise<EventCaptureHealth> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('photos')
    .select('created_at')
    .eq('event_id', eventId)
    .eq('status', 'pending')
    .is('deleted_at', null)

  if (error) throw error

  let uploading = 0
  let stalled = 0
  for (const photo of data ?? []) {
    const age = now - new Date(photo.created_at).getTime()
    if (age >= ABANDONED_CAPTURE_MS) continue
    if (age >= STALLED_CAPTURE_MS) {
      stalled += 1
    } else {
      uploading += 1
    }
  }
  return { uploading, stalled }
}

/** The participant's name for a host-side photo, or null. Guests may always
 *  be named — the join screen requires it — but the join is nullable in the
 *  generated types, so this is where that is resolved once. No placeholder
 *  name: a credit like "Vendég" is copy, and copy belongs in the component
 *  that knows the locale, which simply shows nothing for a nameless photo. */
export function photoUploaderName(photo: HostPhoto): string | null {
  return photo.participants?.display_name ?? null
}

/**
 * A host-side row in the shape the archive naming rules take.
 *
 * `lib/archive-naming.ts` deliberately does not know `HostPhoto` — it has to
 * stay importable from runtimes that never see a Supabase row — so the join is
 * flattened here, once.
 */
export function toArchivePhoto(photo: HostPhoto): ArchivePhoto & HostPhoto {
  return { ...photo, uploaderName: photo.participants?.display_name ?? null }
}

/**
 * A gallery photo with its URLs resolved.
 *
 * The URL is a pure function of the storage path (`lib/photo-urls.ts`), so
 * nothing about a tile is a capability: which photos reach this function at
 * all is the whole of the access decision, and that was made by the
 * reveal-gated RPC before a path was ever returned. The client components
 * below still never see a storage path — they get finished URLs, so the
 * layout of the bucket is not something a page has to know.
 */
export type GalleryTile = {
  id: string
  thumbUrl: string
  viewUrl: string
  uploaderName: string | null
  width: number | null
  height: number | null
}

/**
 * Resolve a page of gallery photos to tiles. Synchronous: building a URL is
 * string work, not a round trip.
 *
 * Every photo becomes a tile. When reads were signed, a path that failed to
 * sign was dropped and a missing object vanished from the album without a
 * trace; now it renders as a broken tile and the grid reports
 * `gallery_image_failed`. Visible is better than silent — a missing object is
 * a bug to fix, and this is how it gets found.
 */
export function toGalleryTiles(photos: readonly GalleryPhoto[]): GalleryTile[] {
  return photos.map((photo) => ({
    id: photo.id,
    thumbUrl: publicPhotoUrl(photo.thumb_path),
    viewUrl: publicPhotoUrl(photo.view_path ?? photo.storage_path),
    uploaderName: photo.uploader_name || null,
    width: photo.width,
    height: photo.height,
  }))
}

/**
 * A host-side photo with its thumbnail URL, for the moderation grid.
 *
 * Carries `hidden_at` — unlike the guest tiles, which never see a hidden photo
 * at all — because moderation is precisely the screen that has to show one and
 * offer to put it back.
 */
export type ModerationTile = {
  id: string
  thumbUrl: string
  /** The ~1600px render the lightbox shows. */
  viewUrl: string
  /** The 3200px master, as an attachment — what Save hands over. The host gets
   *  the print-ready file, the same one the ZIP would have given them. */
  downloadUrl: string
  /** The name that file arrives under, from the archive's own naming rules, so
   *  one photo saved by hand and the same photo out of the ZIP agree. */
  downloadName: string
  uploaderName: string | null
  /** When the shutter fired, for the lightbox's `Anna · 21:47` line. */
  takenAt: string | null
  hidden_at: string | null
}

/**
 * The host's whole grid. Synchronous, like `toGalleryTiles`: on a public bucket
 * a URL is string work, so three of them per photo costs nothing.
 *
 * `timeZone` is the **event's**, never the server's — Vercel runs UTC, and a
 * photo taken at 14:32 in Budapest would otherwise be saved as `1232`, which
 * is the exact trap `lib/archive-naming.ts` documents. It is the same call the
 * ZIP makes, so a photo saved by hand and the same photo out of the archive
 * carry the same stamp and the same name.
 *
 * The leading number will not match, and that is fine: this list is newest
 * first while the archive sorts oldest first. What identifies a frame is the
 * stamp and the name beside it.
 */
export function toModerationTiles(
  photos: readonly HostPhoto[],
  timeZone: string,
): ModerationTile[] {
  return photos.map((photo, index) => {
    // `rejtett/` is the archive's folder for a hidden photo, and a folder is
    // not a filename. One photo saved by hand goes wherever the host's browser
    // puts it.
    const name = archiveEntryName(
      toArchivePhoto(photo),
      index,
      timeZone,
    ).replace(/^rejtett\//, '')

    return {
      id: photo.id,
      thumbUrl: publicPhotoUrl(photo.thumb_path),
      viewUrl: publicPhotoUrl(photo.view_path ?? photo.storage_path),
      downloadName: name,
      downloadUrl: publicPhotoDownloadUrl(photo.storage_path, name),
      uploaderName: photoUploaderName(photo),
      takenAt: photo.taken_at,
      hidden_at: photo.hidden_at,
    }
  })
}
