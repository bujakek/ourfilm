import 'server-only'

import { cache } from 'react'

import { hostDisplayName } from './host-name'
import { createClient } from './supabase/server'
import { reportServerIssue } from './telemetry-server'

export type CurrentHostProfile = {
  id: string
  email: string
  displayName: string
  hasSavedDisplayName: boolean
  /**
   * Whether the name can be changed at all.
   *
   * False only when the profile read failed. If the column cannot be read the
   * RPC that writes it is not there either, so offering the form would be
   * offering a button that cannot work.
   */
  canEditName: boolean
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

    const email = user.email ?? ''

    // Contained rather than thrown, and the deploy window is why. Code reaches
    // Vercel and migrations reach Supabase as two separate events, so there is
    // always a moment when one has landed and the other has not — and before
    // `20260911061351` is applied this read is `42703 undefined_column`, which
    // took the whole account screen to the error boundary. Nothing else on that
    // screen needs the column: the email, the links and sign-out were all
    // readable the entire time.
    //
    // Falling back to `hostDisplayName(email, null)` is not a guess. It is
    // exactly what this product did before the column existed, so the degraded
    // screen is the previous release rather than a broken one.
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Could not read the host profile', error)
      await reportServerIssue(error, {
        operation: 'host_profile_read',
        route: '/host/account',
        routeType: 'page',
        method: 'GET',
      })
      return {
        id: user.id,
        email,
        displayName: hostDisplayName(email, null),
        hasSavedDisplayName: false,
        canEditName: false,
      }
    }

    return {
      id: user.id,
      email,
      displayName: hostDisplayName(email, data?.display_name),
      hasSavedDisplayName: Boolean(data?.display_name),
      canEditName: true,
    }
  },
)
