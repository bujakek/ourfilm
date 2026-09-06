'use server'

import { revalidatePath } from 'next/cache'

import { isLocale } from '@/lib/i18n'
import { createClient } from '@/lib/supabase/server'

/**
 * Change the language the host reads the product in.
 *
 * **Through the RPC, never a direct update.** `profiles` has no self-update
 * policy on purpose — a host may read their role and may not write it — and
 * 20260831150000 grants `authenticated` a blanket UPDATE on every column of
 * that table, so the missing policy is the only thing standing between a host
 * and `role = 'admin'`. `set_profile_locale` is a security definer function
 * that writes one named column for `auth.uid()`, which cannot be talked into
 * writing another or pointed at somebody else's row.
 *
 * Every host screen is revalidated because the stored locale is what a
 * bookmarked, `?lang`-less URL renders in — leaving them cached would show the
 * old language until something else happened to refresh them.
 */
export async function setAccountLocale(locale: string) {
  if (!isLocale(locale)) throw new Error('Unsupported locale.')

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_profile_locale', {
    p_locale: locale,
  })
  if (error) throw error

  revalidatePath('/host', 'layout')
}
