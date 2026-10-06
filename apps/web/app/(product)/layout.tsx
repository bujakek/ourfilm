import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { PostHogLoader } from '@/components/analytics/posthog-loader'
import { bodyClassName, siteMetadata, siteViewport } from '@/lib/document'
import { defaultLocale, localeTag } from '@/lib/i18n'
import '../globals.css'

/**
 * The root layout for the product itself: `/e`, `/host` and `/auth`.
 *
 * These routes are deliberately outside the locale tree — QR codes are printed
 * with `/e/<slug>` and `proxy.ts` guards `/host/:path*` by exact path — so
 * there is no path segment to read a language from. A guest page gets its
 * locale from `?lang` or from `events.locale`, which a layout cannot see:
 * layouts receive `params`, never `searchParams`, and the event row is fetched
 * by the page below.
 *
 * So the document language here is the site default, and the pages that know
 * better mark their own subtree with `lang`. That is correct HTML — `lang` on
 * a container overrides the document for that subtree — and it is the honest
 * answer for a shell that genuinely does not know yet.
 *
 * Every page under here does that now, on the element it already returns:
 * `components/event/join-form.tsx` and `components/event/guest-event-view.tsx`
 * for the guest flow; the four host pages plus
 * `components/host/onboarding/onboarding-shell.tsx` (one shell, so one
 * attribute covers all four create-flow steps),
 * `app/(product)/auth/event-complete/complete-creation.tsx` and
 * `app/(product)/auth/callback/page.tsx` for the host side. A new page here
 * needs the same line — the locale is already resolved in each one, so it is a
 * single attribute, and forgetting it is invisible until someone listens to
 * the page.
 *
 * The two shared screens (`not-found.tsx`, `error.tsx`) render at
 * `defaultLocale`, which is what this document already declares, so they need
 * nothing.
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

export default function ProductRootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html
      lang={localeTag[defaultLocale]}
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
