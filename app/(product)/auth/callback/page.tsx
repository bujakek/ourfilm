import { BackgroundGlow } from '@/components/site/background-glow'
import { LoadingStatus } from '@/components/loading-status'
import type { Metadata } from 'next'

import { CallbackExchange } from './callback-exchange'

export const metadata: Metadata = {
  title: 'Belépés — OurFilm',
  robots: { index: false, follow: false },
}

/**
 * Where the magic link lands.
 *
 * The HTML for "Belépés…" is the response — no data is awaited here — so the
 * tab is never blank while Supabase redeems the code. The client child then
 * calls a Server Action that writes the session cookies (a Server Component
 * cannot) and redirects.
 *
 * Handles both shapes Supabase can send, because which one arrives depends on
 * the email template configured in the dashboard and getting it wrong means a
 * login link that silently does nothing:
 *
 *   ?code=…                    default template, PKCE — exchange for a session
 *   ?token_hash=…&type=magiclink   custom template — verify the OTP directly
 */
export default function AuthCallbackPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <BackgroundGlow />
      <main className="relative z-10">
        <LoadingStatus
          title="Belépés…"
          description="Egy pillanat, átirányítunk az eseményeidhez."
        />
      </main>
      <CallbackExchange />
    </div>
  )
}
