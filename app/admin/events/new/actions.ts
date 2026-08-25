'use server'

import { redirect } from 'next/navigation'

import { isRevealMode, isShotOption, validateEventDraft } from '@/lib/camera'
import { eventLocalToIso, isValidTimeZone } from '@/lib/format'
import { clampRevealDelayDays, revealAfterDelay } from '@/lib/onboarding'
import { generateEventSlug } from '@/lib/slug'
import { coverStoragePath, PHOTO_BUCKET } from '@/lib/storage'
import { createClient } from '@/lib/supabase/server'

export type CreateEventState = { error: string | null }

const SLUG_ATTEMPTS = 5
const UNIQUE_VIOLATION = '23505'

/**
 * Create one disposable camera.
 *
 * The flow collects four answers in the browser and posts them all at once.
 * That is deliberate: a draft row per abandoned wizard would be a second event
 * state to reason about everywhere — the dashboard, the QR, the participant cap
 * — for a form that takes forty seconds to fill in.
 *
 * Everything below is re-validated here even though the wizard already refused
 * it. A disabled button is a courtesy; this is a server action and the FormData
 * arriving at it is whatever the caller decided to send.
 */
export async function createEvent(
  _prev: CreateEventState,
  formData: FormData,
): Promise<CreateEventState> {
  const name = String(formData.get('event_name') ?? '').trim()

  // Read off the browser rather than chosen from a list. Still validated: the
  // value reaches us from a form, and an unknown zone makes `Intl` throw at
  // render time rather than at the point it was accepted.
  const timeZone = String(formData.get('time_zone') ?? '').trim()
  if (!isValidTimeZone(timeZone)) {
    return { error: 'Nem sikerült megállapítani az időzónádat. Próbáld újra.' }
  }

  // **The camera opens now.** Stamped here rather than sent from the browser:
  // the host is never asked when it starts, so the only two candidate answers
  // are the phone's clock and this machine's, and this is the one the database
  // compares `now()` against.
  const captureStartAt = new Date()

  // A datetime-local value carries no zone, so it is read as the *event's* wall
  // clock rather than the server's — Vercel runs UTC, which would move every
  // window two hours from what the host picked.
  const captureEndIso = eventLocalToIso(
    String(formData.get('capture_end_at') ?? '').trim(),
    timeZone,
  )
  const revealModeRaw = String(formData.get('reveal_mode') ?? '')
  const delayDays = clampRevealDelayDays(formData.get('reveal_delay_days'))
  const shots = Number(formData.get('shots_per_participant'))

  if (!captureEndIso) {
    return { error: 'Add meg, mikor érjen véget az esemény.' }
  }
  if (!isRevealMode(revealModeRaw)) {
    return { error: 'Válaszd ki, mikor jelenjenek meg a képek.' }
  }
  if (!isShotOption(shots)) {
    return { error: 'Válaszd ki, hány képet készíthet egy vendég.' }
  }

  const captureEndAt = new Date(captureEndIso)
  // "Later" is counted in whole days from the moment the camera closes. The
  // browser showed the host this exact instant on the badge two screens back,
  // so it is recomputed the same way here rather than trusted from the form.
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
    return { error: 'Adj nevet az eseménynek.' }
  }
  if (problems.includes('window_backwards')) {
    // The camera starts now, so the only way to fail this is an end that has
    // gone by while the form was open.
    return { error: 'Ez az időpont már elmúlt. Válassz későbbit.' }
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
        // Not a question the flow asks. Guests seeing the album after it
        // develops is the product; a host who wants it private has the switch
        // in settings, and putting it in onboarding meant every host answering
        // a question almost none of them have.
        guests_can_view: true,
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

  // Kept working, but nothing posts a cover any more: the Once-shaped flow asks
  // one question per screen and a cover picker is not one of the four. The
  // column is nullable and every surface already renders an event without one.
  // Whatever surfaces the picker next — most likely the settings page — posts
  // to this same field.
  //
  // Deliberately not fatal, either. The cover has no folder to live in until
  // the event id exists, and a host whose cover upload fails should land on a
  // working event they can add a picture to later, not lose the whole thing
  // over a decorative image.
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
