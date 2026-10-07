'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/** Presentation only: the create action still verifies the user on the server.
 * INITIAL_SESSION resolves the first value; subsequent events update the CTA. */
export function useHostSignedIn(): boolean | null {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  useEffect(() => {
    const { data } = createClient().auth.onAuthStateChange(
      (_event, session) => {
        setSignedIn(Boolean(session?.user))
      },
    )
    return () => data.subscription.unsubscribe()
  }, [])
  return signedIn
}
