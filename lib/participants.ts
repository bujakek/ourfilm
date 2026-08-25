import 'server-only'

import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { cache } from 'react'

import { createAdminClient } from './supabase/admin'

/**
 * Guest identity, without accounts.
 *
 * A participant is a random 32-byte token in an httpOnly cookie. The database
 * stores only its SHA-256, so a database dump is not a set of usable session
 * keys and the raw token never leaves this module.
 *
 * `httpOnly` is the load-bearing part, and the reason this replaced the old
 * `ourfilm_name` cookie rather than extending it. That one was written by
 * client JavaScript and readable by it, which was fine when it gated nothing —
 * it was documented as UX, not access control. This one gates a shot limit, so
 * a value the page can read is a value the page can forge.
 *
 * The cookie is still not a security boundary in the sense that matters for
 * privacy: someone who copies it impersonates that participant, and album
 * privacy still rests on the unguessable slug. What it *is* is the thing that
 * stops a guest from spending someone else's film, and stops a guest from
 * spending more than their own.
 */

const TOKEN_BYTES = 32

/**
 * One cookie per event, scoped to that event's path.
 *
 * Path scoping means a guest at three weddings sends one cookie per request
 * rather than three, and that a token can only ever be presented to the event
 * it belongs to.
 */
export function participantCookieName(): string {
  return 'ourfilm_participant'
}

function cookiePath(slug: string): string {
  return `/e/${slug}`
}

/** SHA-256 hex. The only form the token takes outside this module. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * The caller's token for one event, if they have joined it on this device.
 *
 * Returns the raw token; every consumer immediately hashes it. Wrapped in React
 * `cache()` because a single render asks for it in `generateMetadata` and again
 * in the component, and `cookies()` is not deduped for us.
 */
export const readParticipantToken = cache(async (): Promise<string | null> => {
  const store = await cookies()
  const value = store.get(participantCookieName())?.value ?? ''
  return value.trim() || null
})

/** The hash a guest presents, or a value that matches nothing. */
export const readParticipantTokenHash = cache(async (): Promise<string> => {
  const token = await readParticipantToken()
  // An empty string rather than null: every RPC takes the hash as a text
  // argument and compares it, and a guest who has not joined must take the
  // same code path as one whose token is wrong — not a separate branch that
  // could be reasoned about differently.
  return token ? hashSessionToken(token) : ''
})

export type ParticipantSession = { token: string; hash: string }

/** Mint a fresh session. Called only when a guest is actually joining. */
export function newParticipantSession(): ParticipantSession {
  const token = randomBytes(TOKEN_BYTES).toString('base64url')
  return { token, hash: hashSessionToken(token) }
}

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export async function writeParticipantCookie(slug: string, token: string) {
  const store = await cookies()
  store.set(participantCookieName(), token, {
    path: cookiePath(slug),
    httpOnly: true,
    // `lax`, not `strict`, and for the reason the old guest cookie recorded:
    // guests arrive cross-site from a QR scanner app or a WhatsApp link, and
    // `strict` withholds the cookie on exactly those entries — the guest would
    // land on the join screen they had already filled in.
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  })
}

export type JoinResult =
  | { ok: true; participantId: string; displayName: string }
  | { ok: false; reason: 'not_found' | 'cap_reached' | 'invalid_name' }

/**
 * Join an event, or resume an existing session on this device.
 *
 * Goes through `service_role` because `join_event` is granted to nothing else —
 * see `lib/supabase/admin.ts`. The RPC holds the event row while it counts, so
 * five guests tapping "Csatlakozom" at the same instant cannot produce six
 * participants on a free event.
 */
export async function joinEvent({
  slug,
  name,
  session,
}: {
  slug: string
  name: string
  session: ParticipantSession
}): Promise<JoinResult> {
  if (!name.trim()) return { ok: false, reason: 'invalid_name' }

  const db = createAdminClient()
  const { data, error } = await db
    .rpc('join_event', {
      p_slug: slug,
      p_name: name,
      p_token_hash: session.hash,
    })
    .maybeSingle()

  if (error) throw error
  // The RPC returns no rows for an event that does not exist, rather than
  // saying so — telling the caller apart from a real guest would let anyone
  // test slugs for existence.
  if (!data) return { ok: false, reason: 'not_found' }
  if (data.cap_reached) return { ok: false, reason: 'cap_reached' }

  return {
    ok: true,
    participantId: data.participant_id as string,
    displayName: data.display_name as string,
  }
}
