import { Analytics } from '@vercel/analytics/next'
import type { ReactNode } from 'react'

import { bodyClassName, siteMetadata, siteViewport } from '@/lib/document'
import { localeTag } from '@/lib/i18n'
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
 * `components/event/join-form.tsx` and `components/event/guest-event-view.tsx`
 * do this today, which covers the whole guest flow. **The host area does not
 * yet**: its pages read `?lang` (see `app/(product)/host/page.tsx`) but still
 * render inside the default document language. Worth closing, and cheap — the
 * locale is already resolved in each page.
 *
 * None of these routes is indexed (`/e` sets `noindex`, `/host` is behind the
 * auth proxy), so the search-engine half of the problem does not arise here.
 * This is a screen-reader and `:lang()` concern only.
 */
export const metadata = siteMetadata
export const viewport = siteViewport

export default function ProductRootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang={localeTag.en} className="bg-background">
      <body className={bodyClassName}>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
