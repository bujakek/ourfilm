import 'server-only'

import { cache } from 'react'

import { hostDisplayName } from './host-name'
import { createClient } from './supabase/server'

export type CurrentHostProfile = {
  id: string
  email: string
  displayName: string
  hasSavedDisplayName: boolean
}

/**
 * The signed-in account and the one profile field hosts may change.
 *
 * The name helpers live in `lib/host-name.ts` and are deliberately not
 * re-exported from here: re-exporting would put a `server-only` module back on
 * the account form's import graph, which is the build failure this split
 * exists to prevent.
 */
export const getCurrentHostProfile = cache(
  async (): Promise<CurrentHostProfile | null> => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle()
    if (error) throw error

    const email = user.email ?? ''
    return {
      id: user.id,
      email,
      displayName: hostDisplayName(email, data?.display_name),
      hasSavedDisplayName: Boolean(data?.display_name),
    }
  },
)
