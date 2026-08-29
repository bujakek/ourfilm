import { defaultLocale } from '@/lib/i18n'
import { SITE_URL } from '@/lib/site'
import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Manrope } from 'next/font/google'
import './globals.css'

const manrope = Manrope({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-manrope',
  display: 'swap',
})

/**
 * The site-wide defaults are the homepage's own title and description: /hu
 * inherits them verbatim, and every other public page overrides both. Keeping
 * one pair rather than three near-variants is what stops the tab title, the
 * link preview and the search result from disagreeing about what this is.
 */
const TITLE = 'OurFilm – Wedding Guest Photo App'
const DESCRIPTION =
  'Give every wedding guest their own digital roll with one QR code. No app, no accounts and no chasing photos after the wedding.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  authors: [{ name: 'OurFilm' }],
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: `${SITE_URL}/${defaultLocale}`,
    siteName: 'OurFilm',
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        // Crawlers fetch this URL directly — no Next optimization, and WebP
        // support is inconsistent across chat previews. Keep it a real 1200x630 JPEG.
        url: '/images/og-cover.jpg',
        width: 1200,
        height: 630,
        alt: 'A wedding first dance captured with the OurFilm digital guest camera',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/images/og-cover.jpg'],
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#050505',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang={defaultLocale} className="bg-background">
      <body className={`${manrope.variable} font-sans antialiased`}>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
