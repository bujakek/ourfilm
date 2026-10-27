import 'server-only'

import { createClient } from './supabase/server'

/**
 * How much a host's account holds: their own events, and the photos in them
 * that still exist. What the account screen names before deletion.
 *
 * Two count queries under the host's own session, never a row fetch. The
 * `owner_id` filter is explicit on both because RLS alone is not ownership:
 * an admin reads every event, and "your 3 events" must not become everyone's.
 * A deleted photo keeps its row (`deleted_at` is set), so it is left out; a
 * pending reservation is not a photo yet either, the same rule `deletePhoto`
 * counts by.
 */
export async function getHostAlbumTotals(
  userId: string,
): Promise<{ events: number; photos: number }> {
  const supabase = await createClient()

  const [events, photos] = await Promise.all([
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId),
    supabase
      .from('photos')
      .select('id, events!inner(owner_id)', { count: 'exact', head: true })
      .eq('events.owner_id', userId)
      .eq('status', 'ready')
      .is('deleted_at', null),
  ])

  if (events.error) throw events.error
  if (photos.error) throw photos.error
  return { events: events.count ?? 0, photos: photos.count ?? 0 }
}
