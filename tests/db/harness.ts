import { createHash, randomBytes, randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/database.types'

/**
 * Fixtures for the database suite.
 *
 * These tests run against the **linked remote project** and mutate it. There is
 * no local stack in this repo and no `supabase/seed.sql`, and more to the point
 * the properties worth testing here do not exist anywhere but a real Postgres:
 * a row lock holding under genuinely concurrent HTTP requests, an RLS policy
 * refusing a real anon key, a check constraint rejecting a value.
 *
 * Every fixture is namespaced with a uuid and torn down in a `finally`. Nothing
 * here touches a row it did not create.
 *
 * A note on what proves what, carried over from the Python suite this replaces:
 * RLS makes an unauthorised UPDATE or DELETE match zero rows and return 204, so
 * asserting on a status code would report a wide-open table as secure. Assert
 * on the row's state afterwards instead.
 */

function env(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing ${name}. The database suite reads it from .env.local — run it ` +
        'with `pnpm test:db`, which loads that file.',
    )
  }
  return value
}

export const SUPABASE_URL = env('NEXT_PUBLIC_SUPABASE_URL')
export const ANON_KEY = env('NEXT_PUBLIC_SUPABASE_ANON_KEY')
export const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY')

/** Bypasses RLS entirely. Use it to build fixtures and to check what actually
 *  landed — never to prove that somebody *can* do something, because it can do
 *  everything. */
export function serviceClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  })
}

/** What a guest's browser holds: the anon key and nothing else. */
export function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  })
}

/** A signed-in host. Real JWT, so RLS sees a real `auth.uid()`. */
export function userClient(accessToken: string): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

export type TestUser = {
  id: string
  email: string
  accessToken: string
}

/** Create a throwaway confirmed account and sign it in. */
export async function createUser(): Promise<TestUser> {
  const db = serviceClient()
  const email = `pivot-test-${randomUUID().slice(0, 8)}@example.invalid`
  const password = randomUUID()

  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !created.user) throw error ?? new Error('no user')

  const { data: session, error: signInError } =
    await anonClient().auth.signInWithPassword({ email, password })
  if (signInError || !session.session) {
    throw signInError ?? new Error('no session')
  }

  return {
    id: created.user.id,
    email,
    accessToken: session.session.access_token,
  }
}

export async function deleteUser(id: string) {
  await serviceClient().auth.admin.deleteUser(id)
}

export type EventOptions = {
  ownerId: string
  captureStartAt?: Date
  captureEndAt?: Date
  revealMode?: 'instant' | 'event_end' | 'custom'
  revealAt?: Date
  shotsPerParticipant?: number
  guestsCanView?: boolean
}

const HOUR = 60 * 60 * 1000

/** An event that is capturing right now, revealing at the end, 24 frames. */
export async function createEvent(options: EventOptions) {
  const db = serviceClient()
  const start = options.captureStartAt ?? new Date(Date.now() - HOUR)
  const end = options.captureEndAt ?? new Date(Date.now() + HOUR)

  const { data, error } = await db
    .from('events')
    .insert({
      slug: `pivot-test-${randomUUID().slice(0, 8)}`,
      event_name: 'Teszt esemény',
      owner_id: options.ownerId,
      capture_start_at: start.toISOString(),
      capture_end_at: end.toISOString(),
      reveal_mode: options.revealMode ?? 'event_end',
      reveal_at: (options.revealAt ?? end).toISOString(),
      shots_per_participant: options.shotsPerParticipant ?? 24,
      guests_can_view: options.guestsCanView ?? true,
    })
    .select('id, slug, shots_per_participant, reveal_at, reveal_mode')
    .single()

  if (error) throw error
  return data
}

export async function deleteEvent(id: string) {
  const db = serviceClient()

  // Objects first, row second — the same ordering the real delete path uses,
  // and for the same reason: deleting the event cascades the photo rows away,
  // and without them there is no record of which objects to remove. A suite
  // that skipped this would slowly fill the bucket with orphans nothing points
  // at, on the free tier, in the project the app actually runs against.
  const { data: objects } = await db.storage.from('event-photos').list(id)
  if (objects && objects.length > 0) {
    await db.storage
      .from('event-photos')
      .remove(objects.map((o) => `${id}/${o.name}`))
  }

  // Cascades participants and photos.
  await db.from('events').delete().eq('id', id)
}

/** Promote an account to `admin`, which exempts its events from the cap. */
export async function makeAdmin(userId: string) {
  const { error } = await serviceClient()
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', userId)
  if (error) throw error
}

/** Record a settled payment the way the Stripe webhook does. */
export async function markPaid(eventId: string, ownerId: string) {
  const { error } = await serviceClient()
    .from('purchases')
    .insert({
      event_id: eventId,
      owner_id: ownerId,
      stripe_checkout_session_id: `cs_test_${randomUUID()}`,
      amount_minor: 1290000,
      currency: 'huf',
      status: 'paid',
      paid_at: new Date().toISOString(),
    })
  if (error) throw error
}

export type Session = { token: string; hash: string }

/** A guest device's session, minted the way `lib/participants.ts` does. */
export function newSession(): Session {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: createHash('sha256').update(token).digest('hex') }
}

export async function joinEvent(slug: string, name: string, session: Session) {
  const { data, error } = await serviceClient()
    .rpc('join_event', {
      p_slug: slug,
      p_name: name,
      p_token_hash: session.hash,
    })
    .maybeSingle()
  if (error) throw error
  return data
}

export async function reserveShot(
  eventId: string,
  session: Session,
  idempotencyKey = randomUUID(),
) {
  const { data, error } = await serviceClient()
    .rpc('reserve_shot', {
      p_event_id: eventId,
      p_token_hash: session.hash,
      p_idempotency_key: idempotencyKey,
    })
    .maybeSingle()
  if (error) throw error
  return data
}

export async function commitShot(photoId: string, session: Session) {
  const { data, error } = await serviceClient()
    .rpc('commit_shot', {
      p_photo_id: photoId,
      p_token_hash: session.hash,
      p_width: 4032,
      p_height: 3024,
      p_byte_size: 1_500_000,
      p_taken_at: new Date().toISOString(),
    })
    .maybeSingle()
  if (error) throw error
  return data
}

/** Reserve and commit in one go — a whole successful capture. */
export async function takeShot(eventId: string, session: Session) {
  const reserved = await reserveShot(eventId, session)
  if (!reserved || reserved.refusal) return reserved
  await commitShot(reserved.photo_id as string, session)
  return reserved
}

/** How many photo rows an event actually has, by status. */
export async function countPhotos(
  eventId: string,
  status?: 'pending' | 'ready',
) {
  let query = serviceClient()
    .from('photos')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
  if (status) query = query.eq('status', status)
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

export async function countParticipants(eventId: string) {
  const { count, error } = await serviceClient()
    .from('participants')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
  if (error) throw error
  return count ?? 0
}
