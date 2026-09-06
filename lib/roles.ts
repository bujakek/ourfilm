import 'server-only'

import { redirect } from 'next/navigation'
import { cache } from 'react'

import { defaultLocale, isLocale, type Locale, resolveLocale } from './i18n'
import type { Database } from './supabase/database.types'
import { createClient } from './supabase/server'

export type AppRole = Database['public']['Enums']['app_role']

/**
 * The signed-in account's role, or null when nobody is signed in.
 *
 * This is only ever used to decide what the UI *offers*. The enforcement is
 * `public.is_admin()` inside the RLS policies, which no request can talk its
 * way past — reading the role here and acting on it is a convenience, exactly
 * like `uploadsAreOpen()` mirrors `event_accepts_uploads()`.
 *
 * `cache()`d because a page that both renders admin chrome and gates a section
 * on the role would otherwise make the same round trip twice per render.
 */
export const getCurrentRole = cache(async (): Promise<AppRole | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw error

  // The trigger writes a row at signup and the migration backfilled the
  // existing ones, so a missing row means something went wrong rather than
  // that the account is special. `user` is the safe reading of an unknown
  // role: it grants nothing.
  return data?.role ?? 'user'
})

export async function isAdmin(): Promise<boolean> {
  return (await getCurrentRole()) === 'admin'
}

/**
 * The language the signed-in host reads the product in, or null when nobody
 * is signed in.
 *
 * `/host`, `/host/login` and `/auth` sit outside the locale tree and take
 * their language from `?lang`. Every link inside the product sets it, which
 * works right up until something does not — a bookmark, a hand-typed URL, an
 * email client that dropped the query — and `resolveLocale()` then falls back
 * to `defaultLocale`, handing an English host a Hungarian dashboard. This is
 * the answer that survives all three.
 *
 * `?lang` still wins where it is present: it is an explicit request for this
 * page in that language, and a host switching languages must not be argued
 * with by their own stored preference. See `hostLocale()`.
 *
 * Deliberately **not** `events.locale`. That one is the language the *guests*
 * read and it selects the Stripe Price, so a Hungarian host running an
 * English-language wedding holds a Hungarian dashboard and an English camera
 * billed in forint. This is only ever the default that one starts from.
 *
 * `cache()`d alongside `getCurrentRole` so a layout and a page reading it do
 * not make the round trip twice.
 */
export const getAccountLocale = cache(async (): Promise<Locale | null> => {
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

  // **Contained, and deliberately so.** This is a display preference: the
  // worst thing a wrong answer does is render the host's own screen in the
  // other language. Letting it throw instead takes the whole route to the
  // error boundary and leaves a host staring at a broken console — possibly
  // mid-party, on the one screen that has to work in a dim room at 1am. The
  // billing card on the settings page is contained for exactly this reason.
  //
  // It is also what makes the deploy order forgiving rather than fatal. Ship
  // this code before its migration and every `profiles.locale` read is a
  // `42703 undefined_column`; without this branch that is a dead `/host`
  // rather than a host area that is briefly in the default language.
  if (error) {
    console.error('Could not read the account locale', error)
    return null
  }

  // `resolveLocale` rather than a cast: the column is a check-constrained
  // `text`, and a row written before the constraint — or by a future locale
  // this build does not serve — should read as the default, not crash a page.
  return data ? resolveLocale(data.locale) : null
})

/**
 * What language to render a host-area screen in.
 *
 * The precedence is the whole point: an explicit `?lang` is this request
 * asking for this page in that language and always wins; the account's stored
 * preference is what makes a bookmark work; `defaultLocale` catches a signed
 * out visitor on `/host/login`.
 */
export async function hostLocale(lang?: string): Promise<Locale> {
  if (typeof lang === 'string' && isLocale(lang)) return lang
  return (await getAccountLocale()) ?? defaultLocale
}

/**
 * Guard for a page or action that only an operator may reach.
 *
 * Sends a non-admin to `/host` rather than to the login screen: they are
 * probably signed in and simply do not have the role, and bouncing a
 * legitimately signed-in host to a login form is a confusing way to say no.
 */
export async function requireAdmin(): Promise<void> {
  const role = await getCurrentRole()
  if (role === 'admin') return
  redirect(role ? '/host' : '/host/login')
}
