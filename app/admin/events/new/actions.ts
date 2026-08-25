'use server'

import { redirect } from 'next/navigation'

import { isRevealMode, isShotOption, validateEventDraft } from '@/lib/camera'
import { eventLocalToIso, isValidTimeZone } from '@/lib/format'
import { generateEventSlug } from '@/lib/slug'
import { coverStoragePath, PHOTO_BUCKET } from '@/lib/storage'
import { createClient } from '@/lib/supabase/server'

export type CreateEventState = { error: string | null }

const SLUG_ATTEMPTS = 5
const UNIQUE_VIOLATION = '23505'

/**
 * Create one disposable camera.
 *
 * The wizard collects six steps in the browser and posts them all at once. That
 * is deliberate: a draft row per abandoned wizard would be a second event state
 * to reason about everywhere — the dashboard, the QR, the participant cap — for
 * a form that takes forty seconds to fill in.
 *
 * Everything below is re-validated here even though the wizard already refused
 * it. A wizard step is a courtesy; this is a server action and the FormData
 * arriving at it is whatever the caller decided to send.
 */
export async function createEvent(
  _prev: CreateEventState,
  formData: FormData,
): Promise<CreateEventState> {
  const name = String(formData.get('event_name') ?? '').trim()

  const timeZone = String(formData.get('time_zone') ?? '').trim()
  if (!isValidTimeZone(timeZone)) {
    return { error: 'Válassz időzónát.' }
  }

  // A datetime-local value carries no zone, so it is read as the *event's* wall
  // clock rather than the server's — Vercel runs UTC, which would move every
  // window two hours from what the host typed.
  const captureStartIso = eventLocalToIso(
    String(formData.get('capture_start_at') ?? '').trim(),
    timeZone,
  )
  const captureEndIso = eventLocalToIso(
    String(formData.get('capture_end_at') ?? '').trim(),
    timeZone,
  )
  const revealModeRaw = String(formData.get('reveal_mode') ?? '')
  const customRevealIso = eventLocalToIso(
    String(formData.get('reveal_at') ?? '').trim(),
    timeZone,
  )
  const shots = Number(formData.get('shots_per_participant'))
  const guestsCanView = formData.get('guests_can_view') === 'on'

  if (!captureStartIso || !captureEndIso) {
    return { error: 'Add meg, mikortól meddig lehet fotózni.' }
  }
  if (!isRevealMode(revealModeRaw)) {
    return { error: 'Válaszd ki, mikor jelenjenek meg a képek.' }
  }
  if (!isShotOption(shots)) {
    return { error: 'Válaszd ki, hány képet készíthet egy vendég.' }
  }

  const problems = validateEventDraft({
    name,
    captureStartAt: new Date(captureStartIso),
    captureEndAt: new Date(captureEndIso),
    revealMode: revealModeRaw,
    customRevealAt: customRevealIso ? new Date(customRevealIso) : null,
    shotsPerParticipant: shots,
  })

  if (problems.includes('name_required')) {
    return { error: 'Adj nevet az eseménynek.' }
  }
  if (problems.includes('window_backwards')) {
    return { error: 'A fotózás vége legyen későbbi a kezdésnél.' }
  }
  if (problems.includes('reveal_before_end')) {
    return { error: 'A leleplezés nem lehet korábbi a fotózás végénél.' }
  }
  if (problems.length > 0) {
    return { error: 'Nem sikerült létrehozni. Nézd át a beállításokat.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Lejárt a munkameneted. Lépj be újra.' }

  // `reveal_at` is resolved by a trigger for the two pinned modes, so what is
  // sent here only matters for `custom`. Sending the capture end as a
  // placeholder keeps the column's NOT NULL satisfied either way.
  const revealAt =
    revealModeRaw === 'custom'
      ? (customRevealIso ?? captureEndIso)
      : captureEndIso

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
        capture_start_at: captureStartIso,
        capture_end_at: captureEndIso,
        reveal_mode: revealModeRaw,
        reveal_at: revealAt,
        shots_per_participant: shots,
        guests_can_view: guestsCanView,
      })
      .select('id')
      .maybeSingle()

    if (!error && data) {
      slug = candidate
      eventId = data.id
      break
    }
    // Only a slug collision is worth retrying — a fresh random suffix clears
    // it. Anything else is a real failure and should surface.
    if (error && error.code !== UNIQUE_VIOLATION) {
      console.error('Could not create event', error)
      return { error: 'Nem sikerült létrehozni. Próbáld újra.' }
    }
  }

  if (!slug || !eventId) {
    return { error: 'Nem sikerült egyedi linket generálni. Próbáld újra.' }
  }

  // Second phase, and deliberately not fatal. The cover has no folder to live
  // in until the event id exists, and a host whose cover upload fails should
  // land on a working event they can add a picture to later — not lose the
  // whole thing over a decorative image.
  const cover = formData.get('cover')
  if (cover instanceof File && cover.size > 0) {
    const { error: coverError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(coverStoragePath(eventId), cover, {
        contentType: 'image/jpeg',
        upsert: true,
      })

    if (coverError) {
      console.error('Could not upload cover image', coverError)
    } else {
      const { error: patchError } = await supabase
        .from('events')
        .update({ cover_path: coverStoragePath(eventId) })
        .eq('id', eventId)
      if (patchError) console.error('Could not record cover path', patchError)
    }
  }

  // Outside any try/catch on purpose: redirect() signals by throwing, so
  // catching around it would swallow the navigation.
  redirect(`/admin/events/${slug}`)
}
