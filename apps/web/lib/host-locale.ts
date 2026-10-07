import 'server-only'

import { cache } from 'react'

import { isLocale, type Locale, resolveLocale } from './i18n'
import type { Database } from './supabase/database.types'
import { createClient } from './supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The language of everything a host reads: host screens, host mail, and
 * Stripe's page.
 *
 * It belongs to the host's profile, not to an event and not to a browser.
 * Mail is sent by a schedule with no browser to ask, and a host whose phone is
 * in English may still want Hungarian mail — so the profile is the one answer,
 * set at signup from the language they signed up in and changed on
 * `/host/account`.
 *
 * `fallback` (usually the page's `?lang`) only applies to an account with
 * nothing on record, or to a read that failed: a language is never worth an
 * error screen.
 */
export async function getHostLocale(fallback?: unknown): Promise<Locale> {
  return (await profileLocale()) ?? resolveLocale(fallback)
}

/**
 * The signed-in host's profile language, or null. Cached without arguments
 * so the product root layout (which reads it for `<html lang>`) and the page
 * under it share one session check and one query per request, whatever
 * fallback each passes.
 */
const profileLocale = cache(async (): Promise<Locale | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('locale')
    .eq('id', user.id)
    .maybeSingle()

  if (error) return null
  return data?.locale && isLocale(data.locale) ? data.locale : null
})

/** The same answer for a host with no session: a mail the server sends. */
export async function hostLocaleFor(
  db: SupabaseClient<Database>,
  ownerId: string,
  fallback: unknown,
): Promise<Locale> {
  const { data } = await db
    .from('profiles')
    .select('locale')
    .eq('id', ownerId)
    .maybeSingle()
  return data?.locale && isLocale(data.locale)
    ? data.locale
    : resolveLocale(fallback)
}
