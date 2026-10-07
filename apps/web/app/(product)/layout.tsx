import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import type { ReactNode } from 'react'

import { PostHogLoader } from '@/components/analytics/posthog-loader'
import { bodyClassName, siteMetadata, siteViewport } from '@/lib/document'
import {
  DOCUMENT_LANG_HEADER,
  DOCUMENT_ROUTE_HEADER,
} from '@/lib/document-locale'
import { getHostLocale } from '@/lib/host-locale'
import { defaultLocale, type Locale, localeTag } from '@/lib/i18n'
import { LOCALE_PREFERENCE_COOKIE, rootLocale } from '@/lib/locale-preference'
import '../globals.css'

/**
 * The root layout for the product itself: `/e`, `/host` and `/auth`.
 *
 * These routes are deliberately outside the locale tree — QR codes are printed
 * with `/e/<slug>` and `proxy.ts` guards `/host/:path*` by exact path — so
 * there is no path segment to read a language from, and a layout receives
 * neither the pathname nor `searchParams`. So `proxy.ts` passes on which kind
 * of route this is and its `?lang`, and `documentLocale` below repeats the
 * page's own decision from those: a guest's saved choice or
 * `Accept-Language`, a host's profile language. `lib/document-locale.ts` has
 * the details. The profile read is shared with the page through React's
 * request cache, so it costs no second query.
 *
 * It is still a guess for the few pages that decide otherwise (the create
 * flow and the login screen go by `?lang` alone), so every page keeps marking
 * its own subtree with `lang` as well — correct HTML, since `lang` on a
 * container overrides the document for that subtree:
 * `components/event/join-form.tsx` and `components/event/guest-event-view.tsx`
 * for the guest flow; the host pages plus
 * `components/host/onboarding/onboarding-shell.tsx` (one shell, so one
 * attribute covers all four create-flow steps),
 * `app/(product)/auth/event-complete/complete-creation.tsx` and
 * `app/(product)/auth/callback/page.tsx` for the host side. A new page here
 * needs the same line.
 *
 * The two shared screens (`not-found.tsx`, `error.tsx`) render at
 * `defaultLocale`, which is what this document falls back to when the proxy
 * did not mark the request.
 *
 * None of these routes is indexed (`/e` sets `noindex`, `/host` is behind the
 * auth proxy), so the search-engine half of the problem does not arise here.
 * This is a screen-reader and `:lang()` concern only.
 */
export const metadata: Metadata = {
  ...siteMetadata,
  // Nothing outside React may rewrite these pages. Browser translation swaps
  // text nodes for `<font>` elements and iOS data detectors wrap digit runs
  // such as "12 900 FT" in links; React still holds the original nodes, and
  // the next commit that removes or moves one throws `NotFoundError`. That
  // took down the create flow's last screen four times for one host on
  // Chrome for iOS in October 2026. The product is already rendered in the
  // reader's language, so translation has nothing to add here; the marketing
  // site keeps both.
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
    url: false,
  },
  other: { google: 'notranslate' },
}
export const viewport = siteViewport

async function documentLocale(): Promise<Locale> {
  const [requestHeaders, cookieStore] = await Promise.all([
    headers(),
    cookies(),
  ])
  switch (requestHeaders.get(DOCUMENT_ROUTE_HEADER)) {
    case 'guest':
      return rootLocale({
        cookie: cookieStore.get(LOCALE_PREFERENCE_COOKIE)?.value,
        acceptLanguage: requestHeaders.get('accept-language'),
      })
    case 'host':
      return getHostLocale(requestHeaders.get(DOCUMENT_LANG_HEADER))
    default:
      return defaultLocale
  }
}

export default async function ProductRootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html
      lang={localeTag[await documentLocale()]}
      translate="no"
      className="bg-background"
    >
      <body className={bodyClassName}>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
        {/* Product analytics — see lib/telemetry.ts. Loads only where
            NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is set, after the page has painted. */}
        <PostHogLoader />
      </body>
    </html>
  )
}
