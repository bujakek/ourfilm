import 'server-only'

import { hostDisplayName } from './host-name'
import { newParticipantSession } from './participants'
import { createAdminClient } from './supabase/admin'
import { createClient } from './supabase/server'

/**
 * The host's own roll, on their own event.
 *
 * A photo belongs to a participant — `photos.participant_id` is not null so
 * that every frame has spent somebody's film — so a host who takes a picture
 * is a participant too. What they are not is a guest: they hold no
 * `/e/<slug>` cookie (it is path-scoped, and a Server Action posts to the path
 * of the page that owns it), and they do not count against the free
 * participant cap. Identity comes from the session Supabase already
 * authenticated, and `participants.user_id` is the link.
 *
 * `session_token_hash` is minted once, randomly, and then only ever read back
 * from the row. It exists because every capture RPC is keyed on it — the guest
 * path is the one that must present a token, and reusing that key here means
 * `reserve_shot`, `commit_shot` and `release_shot` need no host-shaped variant
 * at all.
 */

export type HostParticipant = {
  eventId: string
  participantId: string
  /** What the capture RPCs are keyed on. Never sent to a browser. */
  tokenHash: string
}

/**
 * Resolve — and on first use create — the signed-in host's participant row for
 * an event they own.
 *
 * **Ownership is the caller's to establish**, and every caller does it the way
 * the rest of the host area does: `getOwnedEventBySlug` returning null under
 * ownership RLS *is* the check. This function is handed an event id that has
 * already passed it, which is why it may then use the service role — the RPC
 * it calls will mint a participant on any event it is given.
 */
export async function hostParticipant(
  eventId: string,
): Promise<HostParticipant | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError) throw profileError

  const { data, error } = await createAdminClient()
    .rpc('host_participant', {
      p_event_id: eventId,
      p_user_id: user.id,
      p_name: hostDisplayName(user.email, profile?.display_name),
      // Only used when the row is being created. An existing row hands its own
      // hash back and this is discarded — which is the point: a rotating hash
      // would strand a `commit_shot` issued against the previous one.
      p_token_hash: newParticipantSession().hash,
    })
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    eventId,
    participantId: data.participant_id,
    tokenHash: data.token_hash,
  }
}
