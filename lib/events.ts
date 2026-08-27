import 'server-only'

import { cache } from 'react'

import { readParticipantTokenHash } from './participants'
import { createAdminClient } from './supabase/admin'
import { createClient } from './supabase/server'
import type { Database } from './supabase/database.types'

/**
 * Everything the guest surface is allowed to know, plus what this particular
 * guest is allowed to do.
 *
 * Derived from the RPC's own return type rather than hand-written, so adding a
 * column to the function without updating callers is a compile error instead of
 * a silent `undefined`. Note the omissions: no `owner_id`, no `guests_can_view`
 * — a guest gets the resolved permission, not the setting behind it.
 *
 * The permission booleans (`can_capture`, `can_guest_view_gallery`) are computed
 * in Postgres, not here. That is the point: the join screen, the camera and the
 * gallery all read the same three fields, so they cannot drift apart about
 * whether the camera is open.
 */
export type GuestEventState =
  Database['public']['Functions']['event_guest_state']['Returns'][number]

/**
 * The event as this guest sees it, keyed on their session cookie.
 *
 * Goes through `service_role`, unlike every guest read before it. The RPC takes
 * the session token hash and returns this guest's own participant row and shot
 * count alongside the event, and granting that to `anon` would make an observed
 * hash enough to read someone's state. The cookie is httpOnly and only a server
 * action or Server Component can present it, so the read belongs here.
 *
 * Wrapped in React `cache()` because every event route needs it twice — once in
 * `generateMetadata` to title the page, once in the component. Unlike `fetch`,
 * Next does not dedupe arbitrary async calls, so without this each render costs
 * two identical round trips.
 */
export const getGuestEventState = cache(
  async (slug: string): Promise<GuestEventState | null> => {
    const tokenHash = await readParticipantTokenHash()
    const db = createAdminClient()

    const { data, error } = await db
      .rpc('event_guest_state', { p_slug: slug, p_token_hash: tokenHash })
      .maybeSingle()

    // supabase-js resolves rather than rejects on a failed query, so an
    // unchecked call here would quietly return null and render a 404 for what
    // is actually an outage.
    if (error) throw error

    return data
  },
)

/**
 * The same row, without consulting the caller's session.
 *
 * For `generateMetadata`, which needs the event's name and nothing else.
 * Reading cookies there would make the page's metadata depend on which guest is
 * asking — a per-participant `<title>` is meaningless, and it drags the cookie
 * read into a second, separately-suspended part of the render for no gain.
 *
 * Passing an empty token hash is the same code path a guest who has not joined
 * takes, so there is no second query shape to keep in step.
 */
export const getPublicEventBySlug = cache(
  async (slug: string): Promise<GuestEventState | null> => {
    const db = createAdminClient()
    const { data, error } = await db
      .rpc('event_guest_state', { p_slug: slug, p_token_hash: '' })
      .maybeSingle()

    if (error) throw error
    return data
  },
)

/** Has this guest joined on this device? Everything else on the guest surface
 *  is gated on it, and it is simply whether the RPC found a participant. */
export function hasJoined(state: GuestEventState): boolean {
  return state.participant_id !== null
}

/** The single aggregate the unified guest event page shows about other guests.
 * Names and participant rows never leave the server. */
export async function getGuestParticipantCount(
  eventId: string,
): Promise<number> {
  const db = createAdminClient()
  const { count, error } = await db
    .from('participants')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)

  if (error) throw error
  return count ?? 0
}

export type OwnedEvent = {
  id: string
  slug: string
  event_name: string
  cover_path: string | null
  time_zone: string
  capture_start_at: string
  capture_end_at: string
  reveal_mode: Database['public']['Enums']['reveal_mode']
  reveal_at: string
  shots_per_participant: number
  guests_can_view: boolean
  created_at: string
}

const OWNED_EVENT_COLUMNS =
  'id, slug, event_name, cover_path, time_zone, capture_start_at, capture_end_at, reveal_mode, reveal_at, shots_per_participant, guests_can_view, created_at'

/**
 * One of the host's own events, by slug. Returns null when it does not exist
 * *or* belongs to someone else — RLS makes those indistinguishable here, which
 * is the correct answer to give either way.
 *
 * Reads the table directly rather than an RPC, on purpose. The host is signed
 * in, so ownership policies are the boundary, and the host is the one viewer
 * who must see the event regardless of reveal or guest visibility.
 */
export const getOwnedEventBySlug = cache(
  async (slug: string): Promise<OwnedEvent | null> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('events')
      .select(OWNED_EVENT_COLUMNS)
      .eq('slug', slug)
      .maybeSingle()

    if (error) throw error
    return data
  },
)

export type EventWithPreview = OwnedEvent & {
  photoCount: number
  participantCount: number
  /** A few thumbnails for the list, newest first. */
  previews: string[]
}

/**
 * The admin list, with enough of each event to recognise it at a glance.
 *
 * Aggregated in Postgres rather than pulling every photo row into the server:
 * each event returns only its counts and four recent visible thumbnail paths.
 * The function is SECURITY INVOKER, so the same ownership RLS policies that
 * protect direct table reads also scope this result.
 */
export async function getOwnedEventsWithPreviews(): Promise<
  EventWithPreview[]
> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('owned_events_with_previews')

  if (error) throw error

  return (data ?? []).map(
    ({ photo_count, participant_count, cover_path, ...event }) => ({
      ...event,
      // The generator types a table-returning function's columns as
      // non-nullable, so it claims `cover_path: string` for a column that is
      // genuinely null on most events. Asserted here so no caller inherits the
      // lie — the same wrinkle `lib/billing.ts` documents.
      cover_path: cover_path as string | null,
      photoCount: photo_count,
      participantCount: participant_count,
    }),
  )
}

/**
 * One row of the admin list, with its preview thumbnails signed.
 *
 * The list is the one host screen that renders many events at once, so the
 * signing happens in a single batch across all of them rather than per event.
 */
export type EventListItem = Omit<EventWithPreview, 'previews'> & {
  previewUrls: string[]
}

/** Whether guests can shoot right now. Display only — `reserve_shot` decides. */
export function captureIsOpen(event: {
  capture_start_at: string
  capture_end_at: string
}): boolean {
  const now = Date.now()
  return (
    now >= new Date(event.capture_start_at).getTime() &&
    now <= new Date(event.capture_end_at).getTime()
  )
}

/** The host's events, ready to render. */
export async function getEventListItems(): Promise<EventListItem[]> {
  const events = await getOwnedEventsWithPreviews()

  const { signPhotoUrls } = await import('./photo-urls')
  const signed = await signPhotoUrls(events.flatMap((e) => e.previews))

  return events.map(({ previews, ...event }) => ({
    ...event,
    previewUrls: previews.flatMap((path) => {
      const url = signed.get(path)
      return url ? [url] : []
    }),
  }))
}
