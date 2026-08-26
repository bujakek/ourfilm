'use server'

import { getEventQuota } from '@/lib/billing'
import { isRevealMode, isShotOption, validateEventDraft } from '@/lib/camera'
import { eventLocalToIso, isValidTimeZone } from '@/lib/format'
import {
  clampRevealDelayDays,
  isEventPlan,
  revealAfterDelay,
} from '@/lib/onboarding'
import { generateEventSlug } from '@/lib/slug'
import { createEventCheckoutUrl } from '@/lib/stripe/checkout'
import { stripeIsConfigured } from '@/lib/stripe/env'
import { coverStoragePath, PHOTO_BUCKET } from '@/lib/storage'
import { createClient } from '@/lib/supabase/server'

/** What the browser sends. Every field is re-derived or re-checked below — it
 *  comes out of `localStorage`, which is a JSON blob any visitor can edit. */
export type EventDraftInput = {
  name: string
  /** `YYYY-MM-DDTHH:mm`, read as wall clock in `timeZone`. */
  endLocal: string
  timeZone: string
  revealMode: string
  delayDays: number
  shots: number
  plan: string
  guestsCanView: boolean
  /** Per-draft uuid. Makes a repeat attempt land on the event the first one
   *  created instead of a second one. Optional: a flow with no draft behind it
   *  has nothing to be idempotent about. */
  creationKey?: string | null
}

export type CreateEventResult =
  | { ok: true; destination: string }
  | {
      ok: false
      error: string
      /** `auth` — nobody is signed in, so the browser should ask for an
       *  account and try again. `end` — the chosen end has gone by while the
       *  draft sat there, and the flow should reopen the date screen with
       *  every other answer intact. */
      reason?: 'auth' | 'end'
    }

const SLUG_ATTEMPTS = 5
const UNIQUE_VIOLATION = '23505'
const CREATION_KEY_INDEX = 'events_owner_creation_key_idx'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Create one disposable camera, and say where the host should go next.
 *
 * **Returns rather than redirects.** The browser owns one thing the server
 * cannot see — the `localStorage` draft — and it must not clear it until the
 * event actually exists. A `redirect()` here would navigate away before the
 * client could, which is how a host ends up with an event and a stale draft
 * offering to recreate it.
 *
 * Everything below is re-validated even though the form already refused it.
 * The draft is client-side JSON: a plan of `full` in it is a *wish*, the shot
 * count is whatever someone typed in devtools, and the end date was chosen at
 * some point in the last week. None of it is an entitlement and none of it is
 * fresh.
 */
export async function createEventFromDraft(
  input: EventDraftInput,
): Promise<CreateEventResult> {
  const name = String(input.name ?? '').trim()

  // Read off the host's browser rather than chosen from a list. Still checked:
  // an unknown zone makes `Intl` throw at render time rather than at the point
  // it was accepted.
  const timeZone = String(input.timeZone ?? '').trim()
  if (!isValidTimeZone(timeZone)) {
    return { ok: false, error: 'Nem sikerült megállapítani az időzónádat.' }
  }

  // **The camera opens now.** Stamped here rather than sent from the browser:
  // the host is never asked when it starts, so the only two candidate answers
  // are the phone's clock and this machine's, and this is the one the database
  // compares `now()` against.
  const captureStartAt = new Date()

  const captureEndIso = eventLocalToIso(String(input.endLocal ?? ''), timeZone)
  const revealModeRaw = String(input.revealMode ?? '')
  const delayDays = clampRevealDelayDays(input.delayDays)
  const shots = Number(input.shots)
  const planRaw = String(input.plan ?? 'free')
  const guestsCanView = input.guestsCanView === true

  if (!captureEndIso) {
    return {
      ok: false,
      error: 'Add meg, mikor érjen véget az esemény.',
      reason: 'end',
    }
  }
  if (!isRevealMode(revealModeRaw)) {
    return { ok: false, error: 'Válaszd ki, mikor jelenjenek meg a képek.' }
  }
  if (!isShotOption(shots)) {
    return { ok: false, error: 'Válaszd ki, hány képet készíthet egy vendég.' }
  }
  if (!isEventPlan(planRaw)) {
    return { ok: false, error: 'Válaszd ki, hány vendég csatlakozhat.' }
  }

  const captureEndAt = new Date(captureEndIso)
  const customRevealAt =
    revealModeRaw === 'custom'
      ? revealAfterDelay(captureEndAt, delayDays)
      : null

  const problems = validateEventDraft({
    name,
    captureStartAt,
    captureEndAt,
    revealMode: revealModeRaw,
    customRevealAt,
    shotsPerParticipant: shots,
  })

  if (problems.includes('name_required')) {
    return { ok: false, error: 'Adj nevet az eseménynek.' }
  }
  if (problems.includes('window_backwards')) {
    // The camera starts now, so the only way to fail this is an end that has
    // gone by — which is the common case for a draft resumed a day later, and
    // why it is worth its own reason code rather than a sentence.
    return {
      ok: false,
      error: 'Ez az időpont már elmúlt. Válassz későbbit.',
      reason: 'end',
    }
  }
  if (problems.includes('reveal_before_end')) {
    return {
      ok: false,
      error: 'A leleplezés nem lehet korábbi a fotózás végénél.',
    }
  }
  if (problems.length > 0) {
    return {
      ok: false,
      error: 'Nem sikerült létrehozni. Nézd át a beállításokat.',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // The one thing the create flow does not do signed out. Everything up to
  // here is a form; this is a row with an owner.
  if (!user) {
    return {
      ok: false,
      error: 'Az esemény mentéséhez lépj be.',
      reason: 'auth',
    }
  }

  const creationKey =
    typeof input.creationKey === 'string' && UUID.test(input.creationKey)
      ? input.creationKey
      : null

  // Idempotency, first pass: the common case is a resumed draft whose event
  // already exists — a reloaded callback URL, a second tab, a back button. One
  // indexed lookup is cheaper than an insert that has to fail.
  if (creationKey) {
    const { data: existing } = await supabase
      .from('events')
      .select('slug')
      .eq('owner_id', user.id)
      .eq('creation_key', creationKey)
      .maybeSingle()
    if (existing) {
      return { ok: true, destination: `/admin/events/${existing.slug}` }
    }
  }

  const revealAt = (customRevealAt ?? captureEndAt).toISOString()

  let slug: string | null = null
  let eventId: string | null = null

  for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt++) {
    const candidate = generateEventSlug(name)
    const { data, error } = await supabase
      .from('events')
      .insert({
        slug: candidate,
        event_name: name,
        owner_id: user.id,
        time_zone: timeZone,
        capture_start_at: captureStartAt.toISOString(),
        capture_end_at: captureEndIso,
        reveal_mode: revealModeRaw,
        reveal_at: revealAt,
        shots_per_participant: shots,
        guests_can_view: guestsCanView,
        creation_key: creationKey,
      })
      .select('id, slug')
      .maybeSingle()

    if (!error && data) {
      slug = data.slug
      eventId = data.id
      break
    }

    if (error?.code === UNIQUE_VIOLATION) {
      // Two different unique indexes can raise this, and they mean opposite
      // things. A creation-key collision is the race the key exists to win:
      // another request beat us to it, so the correct answer is *its* event.
      if (error.message.includes(CREATION_KEY_INDEX) && creationKey) {
        const { data: raced } = await supabase
          .from('events')
          .select('slug')
          .eq('owner_id', user.id)
          .eq('creation_key', creationKey)
          .maybeSingle()
        if (raced)
          return { ok: true, destination: `/admin/events/${raced.slug}` }
        return { ok: false, error: 'Nem sikerült létrehozni. Próbáld újra.' }
      }
      // Otherwise it is a slug collision, which a fresh random suffix clears.
      continue
    }

    if (error) {
      console.error('Could not create event', error)
      return { ok: false, error: 'Nem sikerült létrehozni. Próbáld újra.' }
    }
  }

  if (!slug || !eventId) {
    return {
      ok: false,
      error: 'Nem sikerült egyedi linket generálni. Próbáld újra.',
    }
  }

  // Where the host lands, which is the only thing the plan choice decides.
  //
  // `full` is not a column and nothing about the row above is different for
  // it: the free tier is a participant cap enforced inside `join_event`, and
  // only a paid `purchases` row lifts it. So the paid choice means "and now go
  // pay" — a draft that says `full` buys nothing on its own, and an abandoned
  // checkout leaves an ordinary free event.
  let destination = `/admin/events/${slug}`

  if (planRaw === 'full') {
    // Settings, not the event page, whenever the payment cannot be started
    // here: that is where the billing card is, and it explains the situation —
    // payments not switched on, or try again — better than a silent landing on
    // the QR code would.
    destination = `/admin/events/${slug}/settings`
    if (stripeIsConfigured()) {
      try {
        // An admin's own events are already unlimited, so there is nothing to
        // sell them. Same predicate the billing card reads.
        const quota = await getEventQuota(eventId)
        if (quota.unlimited) {
          destination = `/admin/events/${slug}`
        } else {
          destination = await createEventCheckoutUrl({
            eventId,
            slug,
            ownerId: user.id,
            ownerEmail: user.email ?? null,
          })
        }
      } catch (e) {
        // The event exists and works. Failing to start a checkout is not a
        // reason to lose it, so this is logged and the host lands on the card
        // that can retry.
        console.error('Could not start checkout for a new event', e)
      }
    }
  }

  return { ok: true, destination }
}

/**
 * Attaches a cover image to an event that already exists.
 *
 * Nothing calls this yet: the create flow has no cover picker, because it is
 * filled in signed out and a chosen image cannot ride through an auth round
 * trip in `localStorage` — a base64 photo in a 5MB store is exactly what that
 * store is not for. Kept because the storage path, the bucket policy and the
 * `cover_path` write are the fiddly half, and the picker that will eventually
 * live in settings needs all three.
 */
export async function attachEventCover(eventId: string, cover: File) {
  const supabase = await createClient()
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(coverStoragePath(eventId), cover, {
      contentType: 'image/jpeg',
      upsert: true,
    })
  if (error) throw error

  const { error: patchError } = await supabase
    .from('events')
    .update({ cover_path: coverStoragePath(eventId) })
    .eq('id', eventId)
  if (patchError) throw patchError
}
