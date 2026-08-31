import { BackgroundGlow } from '@/components/site/background-glow'
import { localeTag } from '@/lib/i18n'
import { LoadingStatus } from '@/components/loading-status'
import type { Metadata } from 'next'

import { CallbackExchange } from './callback-exchange'

type Props = {
  searchParams: Promise<{ lang?: string }>
}

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const { lang } = await searchParams
  return {
    title: lang === 'hu' ? 'Belépés — OurFilm' : 'Signing in — OurFilm',
    robots: { index: false, follow: false },
  }
}

/**
 * Where the magic link lands.
 *
 * The HTML for the signing-in status is the response — no data is awaited
 * beyond `searchParams`, which is already known at request time — so the tab
 * is never blank while Supabase redeems the code. The client child then calls
 * a Server Action that writes the session cookies (a Server Component cannot)
 * and redirects.
 *
 * The language comes from `?lang`, which both `signInWithOtp` callers put on
 * `emailRedirectTo` before the link is ever sent. That is the only carrier
 * across the mail round trip: this page is reached from an email client with
 * no referrer, no session and no locale segment in the path. An unknown or
 * missing value falls back to `defaultLocale`, so a hand-typed URL still
 * renders something honest.
 *
 * Handles both shapes Supabase can send, because which one arrives depends on
 * the email template configured in the dashboard and getting it wrong means a
 * login link that silently does nothing:
 *
 *   ?code=…                    default template, PKCE — exchange for a session
 *   ?token_hash=…&type=magiclink   custom template — verify the OTP directly
 */
export default async function AuthCallbackPage({ searchParams }: Props) {
  const { lang } = await searchParams
  const locale = lang === 'hu' ? 'hu' : 'en'
  const en = locale === 'en'

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <BackgroundGlow />
      <main
        className="relative z-10"
        // See the note in `app/(product)/layout.tsx`: `/auth` has no locale
        // segment, so the document is the site default and the page marks the
        // language it actually resolved on its own subtree.
        lang={localeTag[locale]}
      >
        <LoadingStatus
          title={en ? 'Signing you in…' : 'Belépés…'}
          description={
            en
              ? 'One moment while we take you to your events.'
              : 'Egy pillanat, átirányítunk az eseményeidhez.'
          }
        />
      </main>
      <CallbackExchange />
    </div>
  )
}
