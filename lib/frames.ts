import 'server-only'

import { readParticipantTokenHash } from './participants'
import { signPhotoUrls } from './photo-urls'
import { createAdminClient } from './supabase/admin'

/**
 * The guest's own roll.
 *
 * The film strip needs the caller's own frames, which no other read returns:
 * `event_gallery_by_slug` is reveal-gated and carries everyone's photos, and
 * the host-side read is behind ownership RLS. `my_frames` is the narrow answer
 * — see `20260902100000_guest_own_frames.sql` for why it is not reveal-gated
 * and what keeps it from becoming a way to read somebody else's roll.
 *
 * Service role, like every read keyed on the session token: the RPC is granted
 * to nothing else, because a token hash is presentable but not secret once
 * observed, and only a server action or Server Component holds the httpOnly
 * cookie it comes from.
 */

/**
 * One frame of the roll, exposed.
 *
 * `thumbUrl` is null for a frame the host has hidden. The frame is still spent
 * — `participant_shots_used` counts hidden photos, so that hiding cannot become
 * a way to shoot forever — so the cell keeps its place in the strip and simply
 * has nothing to show.
 */
export type Frame = {
  /**
   * The photo's own id. The guest screen matches its in-flight cells against
   * this rather than against `index`, because uploads finish out of order once
   * a failed one is deferred and retried behind a later success.
   */
  id: string
  index: number
  thumbUrl: string | null
}

export async function getMyFrames(eventId: string): Promise<Frame[]> {
  const tokenHash = await readParticipantTokenHash()
  if (!tokenHash) return []

  const db = createAdminClient()
  const { data, error } = await db.rpc('my_frames', {
    p_event_id: eventId,
    p_token_hash: tokenHash,
  })

  if (error) throw error

  // The type generator declares every column of a table-returning function
  // non-nullable, so it claims `thumb_path: string` for an expression that is
  // deliberately null on a hidden frame. Asserted here so no caller inherits
  // the lie — the same wrinkle `lib/events.ts` documents for `cover_path`.
  const rows = (data ?? []) as {
    photo_id: string
    frame_index: number
    thumb_path: string | null
  }[]

  const signed = await signPhotoUrls(rows.map((row) => row.thumb_path))

  return rows.map((row) => ({
    id: row.photo_id,
    index: row.frame_index,
    thumbUrl: row.thumb_path ? (signed.get(row.thumb_path) ?? null) : null,
  }))
}
