import type { Metadata, Viewport } from 'next'
import { Instrument_Serif, Manrope, Martian_Mono } from 'next/font/google'

import { defaultLocale } from '@/lib/i18n'
import { SITE_URL } from '@/lib/site'

/**
 * The pieces every root layout needs, in one place.
 *
 * There are two root layouts — `app/[locale]` for the public site and
 * `app/(product)` for `/e`, `/host` and `/auth` — because `<html lang>` has to
 * vary and only a root layout can set it. Everything below is what they must
 * agree on: one font instance, one metadata base, one viewport. Duplicating
 * any of it is how the two halves of the site drift apart.
 *
 * `<html>` and `<body>` are deliberately *not* here. Next looks for them in
 * the root layout itself, and hiding them behind a component is a needless bet
 * on that detection.
 */
const manrope = Manrope({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-manrope',
  display: 'swap',
})

/**
 * The display face: event names, page headlines, section headings. 400 is the
 * only weight Instrument Serif ships, so `font-display` must never be paired
 * with a `font-semibold` — the browser would answer with a synthetic bold.
 */
const instrumentSerif = Instrument_Serif({
  // `latin-ext` is not optional: Hungarian needs ő and ű, and without it the
  // one word most likely to be set in this face — an event name — falls back
  // mid-string. `Anna & Péter esküvője` is the check.
  subsets: ['latin', 'latin-ext'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-instrument-serif',
  display: 'swap',
})

/** The counting face: frames, countdowns, guest counts, prices, slugs,
 *  timestamps, all-caps eyebrows. Never a sentence. */
const martianMono = Martian_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500'],
  variable: '--font-martian-mono',
  display: 'swap',
})

/** Goes on `<body>` in both root layouts. */
export const bodyClassName = `${manrope.variable} ${instrumentSerif.variable} ${martianMono.variable} font-sans antialiased`

/**
 * The site-wide defaults are the homepage's own title and description: the
 * locale home inherits them verbatim, and every other public page overrides
 * both. Keeping one pair rather than three near-variants is what stops the tab
 * title, the link preview and the search result from disagreeing about what
 * this is.
 */
const TITLE = 'OurFilm – Wedding Guest Photo App'
const DESCRIPTION =
  'Give every wedding guest their own digital roll with one QR code. No app, no accounts and no chasing photos after the wedding.'

export const siteMetadata: Metadata = {
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

export const siteViewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#050505',
  width: 'device-width',
  initialScale: 1,
}
