import { Analytics } from '@vercel/analytics/next'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { bodyClassName, siteMetadata, siteViewport } from '@/lib/document'
import { isLocale, localeTag, locales } from '@/lib/i18n'
import '../globals.css'

/**
 * The root layout for every public, locale-prefixed page.
 *
 * **This is a root layout, not a nested one** — it renders `<html>` and
 * `<body>` itself, and `app/layout.tsx` no longer exists. That is the whole
 * reason for the split: `<html lang>` has to say `hu` on a Hungarian page, and
 * only a layout that knows the locale can set it. It was briefly patched after
 * hydration by an inline script instead, which meant every server-rendered
 * Hungarian page — all of the indexed ones — shipped `lang="en"` to crawlers
 * and to anything reading the initial markup.
 *
 * `app/(product)` is the other root layout, for `/e`, `/host` and `/auth`.
 * Those sit outside the locale tree (a printed QR code and an auth matcher
 * both depend on it) so they cannot get their language from a path segment.
 *
 * The cost of two root layouts is that unmatched URLs no longer have a single
 * layout to compose a 404 from — hence `app/global-not-found.tsx` and
 * `experimental.globalNotFound` in `next.config.mjs`.
 */
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

/** With `generateStaticParams` above, an unlisted locale is not built and does
 *  not fall through to a runtime render. The explicit check below covers the
 *  same ground in dev, where `dynamicParams` does not apply. */
export const dynamicParams = false

export const metadata = siteMetadata
export const viewport = siteViewport

export default async function LocaleRootLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return (
    <html lang={localeTag[locale]} className="bg-background">
      <body className={bodyClassName}>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
