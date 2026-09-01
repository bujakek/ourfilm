import { BackgroundGlow } from '@/components/site/background-glow'
import { Benefits } from '@/components/site/benefits'
import { Faq } from '@/components/site/faq'
import { FinalCta } from '@/components/site/final-cta'
import { Footer } from '@/components/site/footer'
import { Hero } from '@/components/site/hero'
import { HowItWorks } from '@/components/site/how-it-works'
import { Navbar } from '@/components/site/navbar'
import { PhotoReveal } from '@/components/site/photo-reveal'
import { QrPreview } from '@/components/site/qr-preview'
import { isLocale } from '@/lib/i18n'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/site'

type Props = { params: Promise<{ locale: string }> }

const metadataCopy = {
  en: {
    title: 'OurFilm — Your Wedding, Through Their Eyes',
    description:
      'Give every wedding guest their own digital roll with one QR code. No app, no accounts and no chasing photos after the wedding.',
  },
  hu: {
    title: 'OurFilm — Az esküvőtök, a vendégeitek szemével',
    description:
      'A vendégek QR-kóddal nyitják meg a saját digitális tekercsüket. Nincs app, nincs előnézet, a képek pedig akkor jelennek meg, amikor ti szeretnétek.',
  },
} as const

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const copy = metadataCopy[locale]
  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: `${SITE_URL}/${locale}`,
      languages: {
        en: `${SITE_URL}/en`,
        hu: `${SITE_URL}/hu`,
        'x-default': `${SITE_URL}/en`,
      },
    },
    openGraph: {
      title: copy.title,
      description: copy.description,
      locale: locale === 'en' ? 'en_GB' : 'hu_HU',
      url: `${SITE_URL}/${locale}`,
    },
    twitter: { title: copy.title, description: copy.description },
  }
}

export default async function Page({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return (
    <div className="relative min-h-screen">
      <BackgroundGlow />
      <Navbar locale={locale} />
      <main className="relative z-10">
        {/* <Stats /> and <Testimonials /> are deliberately not rendered.
            Both only ever held invented numbers and invented quotes, and the
            pilot has no verified ones to put in their place. The components
            stay, take their content as props, and can come back the day there
            is something true to show. */}
        <Hero locale={locale} />
        <Benefits locale={locale} />
        <HowItWorks locale={locale} />
        <QrPreview locale={locale} />
        <PhotoReveal locale={locale} />
        <Faq locale={locale} />
        <FinalCta locale={locale} />
      </main>
      <Footer locale={locale} />
    </div>
  )
}
