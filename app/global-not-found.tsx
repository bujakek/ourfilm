import type { Metadata } from 'next'

import { NotFoundScreen } from '@/components/site/not-found-screen'
import { bodyClassName } from '@/lib/document'
import { defaultLocale, localeTag } from '@/lib/i18n'
import './globals.css'

/**
 * The 404 for a URL that matched no route at all.
 *
 * Required because the app has two root layouts (`app/[locale]` and
 * `app/(product)`), so there is no single one for Next to compose an
 * unmatched-URL 404 from. Enabled by `experimental.globalNotFound` in
 * `next.config.mjs`; without that flag this file is inert and unmatched URLs
 * fall back to Next's built-in page.
 *
 * It bypasses layout rendering entirely, which is why it imports the
 * stylesheet and the font class itself and returns a whole document. A URL
 * that matched nothing has no locale to read, so this is the site default —
 * `app/[locale]/not-found.tsx` handles the cases that do sit under a locale.
 *
 * Next injects `noindex` here on its own; no `robots` entry is needed.
 */
export const metadata: Metadata = {
  title: 'Page not found — OurFilm',
}

export default function GlobalNotFound() {
  return (
    <html lang={localeTag[defaultLocale]} className="bg-background">
      <body className={bodyClassName}>
        <NotFoundScreen />
      </body>
    </html>
  )
}
