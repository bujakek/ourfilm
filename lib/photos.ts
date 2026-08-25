import 'server-only'

import { cache } from 'react'

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
        'id, storage_path, thumb_path, view_path, hidden_at, width, height, created_at, taken_at, participant_id, participants(display_name)',
      )
      .eq('event_id', eventId)
      .eq('status', 'ready')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  },
)

/** The participant's name for a host-side photo, or the fallback. Guests may
 *  always be named — the join screen requires it — but the join is nullable in
 *  the generated types, so this is where that is resolved once. */
export function photoUploaderName(photo: HostPhoto): string {
  return photo.participants?.display_name ?? 'Vendég'
}

/**
 * A gallery photo with its URLs already signed.
 *
 * The bucket is private, so a URL is a short-lived capability rather than
 * something derivable from a path. Signing happens on the server, in the same
 * place that decided the viewer is entitled to see the album at all — which
 * means the client components below never learn a storage path and cannot
 * construct a link to one.
 */
export type GalleryTile = {
  id: string
  thumbUrl: string
  viewUrl: string
  uploaderName: string
  width: number | null
  height: number | null
}

/** What a photo shows as its credit when the join somehow produced no name. */
export const GUEST_FALLBACK_NAME = 'Vendég'

/**
 * Sign a page of gallery photos in one round trip.
 *
 * Photos whose objects failed to sign are dropped rather than rendered as
 * broken tiles: a missing object is a bug to fix, not something to show a
 * wedding guest.
 */
export async function toGalleryTiles(
  photos: readonly GalleryPhoto[],
): Promise<GalleryTile[]> {
  const { signPhotoUrls } = await import('./photo-urls')

  const signed = await signPhotoUrls(
    photos.flatMap((p) => [p.thumb_path, p.view_path ?? p.storage_path]),
  )

  return photos.flatMap((photo) => {
    const thumbUrl = signed.get(photo.thumb_path)
    const viewUrl = signed.get(photo.view_path ?? photo.storage_path)
    if (!thumbUrl || !viewUrl) return []

    return [
      {
        id: photo.id,
        thumbUrl,
        viewUrl,
        uploaderName: photo.uploader_name || GUEST_FALLBACK_NAME,
        width: photo.width,
        height: photo.height,
      },
    ]
  })
}

/**
 * A host-side photo with its thumbnail signed, for the moderation grid.
 *
 * Carries `hidden_at` — unlike the guest tiles, which never see a hidden photo
 * at all — because moderation is precisely the screen that has to show one and
 * offer to put it back.
 */
export type ModerationTile = {
  id: string
  thumbUrl: string
  uploaderName: string
  hidden_at: string | null
}

/** Sign a host's whole grid in one round trip. */
export async function toModerationTiles(
  photos: readonly HostPhoto[],
): Promise<ModerationTile[]> {
  const { signPhotoUrls } = await import('./photo-urls')
  const signed = await signPhotoUrls(photos.map((p) => p.thumb_path))

  return photos.flatMap((photo) => {
    const thumbUrl = signed.get(photo.thumb_path)
    if (!thumbUrl) return []
    return [
      {
        id: photo.id,
        thumbUrl,
        uploaderName: photoUploaderName(photo),
        hidden_at: photo.hidden_at,
      },
    ]
  })
}
