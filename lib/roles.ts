import 'server-only'

import { redirect } from 'next/navigation'
import { cache } from 'react'

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
