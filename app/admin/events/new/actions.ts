'use server'

import { eventLocalToIso } from '@/lib/format'
import { generateEventSlug } from '@/lib/slug'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type CreateEventState = { error: string | null }

const SLUG_ATTEMPTS = 5
const UNIQUE_VIOLATION = '23505'

export async function createEvent(
  _prev: CreateEventState,
  formData: FormData,
): Promise<CreateEventState> {
  const name = String(formData.get('event_name') ?? '').trim()
  // A datetime-local value carries no zone, so it is read as the event's wall
  // clock rather than the server's — Vercel runs UTC, which would move every
  // deadline two hours earlier than the host typed.
  const closesAt = eventLocalToIso(
    String(formData.get('uploads_close_at') ?? '').trim(),
  )

  if (!name) return { error: 'Adj nevet az eseménynek.' }
  // Required, unlike before. An optional deadline is one nobody sets, and an
  // event without one accepts uploads forever.
  if (!closesAt) return { error: 'Add meg, meddig tölthetnek fel a vendégek.' }
  if (new Date(closesAt) <= new Date()) {
    return { error: 'A feltöltési határidő legyen a jövőben.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Lejárt a munkameneted. Lépj be újra.' }

  let slug: string | null = null

  for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt++) {
    const candidate = generateEventSlug(name)
    const { error } = await supabase.from('events').insert({
      slug: candidate,
      event_name: name,
      uploads_close_at: closesAt,
      owner_id: user.id,
    })

    if (!error) {
      slug = candidate
      break
    }
    // Only a slug collision is worth retrying — a fresh random suffix clears
    // it. Anything else is a real failure and should surface.
    if (error.code !== UNIQUE_VIOLATION) {
      return { error: 'Nem sikerült létrehozni. Próbáld újra.' }
    }
  }

  if (!slug) {
    return { error: 'Nem sikerült egyedi linket generálni. Próbáld újra.' }
  }

  // Outside any try/catch on purpose: redirect() signals by throwing, so
  // catching around it would swallow the navigation.
  redirect(`/admin/events/${slug}`)
}
