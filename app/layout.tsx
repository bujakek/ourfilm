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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'OurFilm — QR-kódos közös fotóalbum eseményekhez',
  description:
    'Gyűjtsd össze az esküvő vagy esemény vendégfotóit egyetlen közös albumban. QR-kódos feltöltés app és vendégregisztráció nélkül.',
  authors: [{ name: 'OurFilm' }],
  openGraph: {
    type: 'website',
    locale: 'hu_HU',
    url: `${SITE_URL}/${defaultLocale}`,
    siteName: 'OurFilm',
    title: 'OurFilm — A fotók, amiket másképp sosem kapnál meg',
    description:
      'A vendégeid beolvassák a QR-kódot, és egy közös albumba töltik a képeiket. App és regisztráció nélkül.',
    images: [
      {
        // Crawlers fetch this URL directly — no Next optimization, and WebP
        // support is inconsistent across chat previews. Keep it a real 1200x630 JPEG.
        url: '/images/og-cover.jpg',
        width: 1200,
        height: 630,
        alt: 'Esküvői első tánc az OurFilm közös albumában',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OurFilm — A fotók, amiket másképp sosem kapnál meg',
    description:
      'QR-kódos közös fotóalbum esküvőkre és eseményekre. App és regisztráció nélkül.',
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
    <html lang="hu" className="bg-background">
      <body className={`${manrope.variable} font-sans antialiased`}>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
