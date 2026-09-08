import 'server-only'

import { cache } from 'react'

import type { ArchivePhoto } from './archive-naming'
import { publicPhotoUrl } from './photo-urls'
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
 */
export const getAllEventPhotos = cache(
  async (eventId: string): Promise<HostPhoto[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('photos')
      .select(
        'id, storage_path, thumb_path, view_path, hidden_at, width, height, created_at, taken_at, byte_size, participant_id, participants(display_name)',
      )
      .eq('event_id', eventId)
      .eq('status', 'ready')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  },
)

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
  uploaderName: string | null
  hidden_at: string | null
}

/** The host's whole grid. Synchronous, like `toGalleryTiles`. */
export function toModerationTiles(
  photos: readonly HostPhoto[],
): ModerationTile[] {
  return photos.map((photo) => ({
    id: photo.id,
    thumbUrl: publicPhotoUrl(photo.thumb_path),
    uploaderName: photoUploaderName(photo),
    hidden_at: photo.hidden_at,
  }))
}
