import { landingFontClass } from '@/components/landing/fonts'
import { LandingFaq } from '@/components/landing/landing-faq'
import { LandingFinal } from '@/components/landing/landing-final'
import { LandingFooter } from '@/components/landing/landing-footer'
import { LandingHero } from '@/components/landing/landing-hero'
import { LandingHow } from '@/components/landing/landing-how'
import { LandingNav } from '@/components/landing/landing-nav'
import { LandingOccasions } from '@/components/landing/landing-occasions'
import { LandingProof } from '@/components/landing/landing-proof'
import { LandingTryCard } from '@/components/landing/landing-try-card'
import { isLocale, localeOgTag } from '@/lib/i18n'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { canonicalUrl, localizedPageAlternates } from '@/lib/seo'

type Props = { params: Promise<{ locale: string }> }

const metadataCopy = {
  en: {
    title: 'OurFilm | Your days, through everyone’s eyes',
    description:
      'One shared digital disposable camera for weddings, birthdays, trips and parties. Guests scan a QR code and shoot — no app, no accounts, every photo in one album.',
  },
  hu: {
    title: 'OurFilm | A ti napotok, mindenki szemével',
    description:
      'Egy közös digitális eldobható kamera esküvőre, születésnapra, utazásra és bulira. A vendégek QR-kóddal fotóznak — nincs app, nincs regisztráció, minden kép egy albumban.',
  },
} as const

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const copy = metadataCopy[locale]
  return {
    title: copy.title,
    description: copy.description,
    alternates: localizedPageAlternates(locale, '/'),
    openGraph: {
      title: copy.title,
      description: copy.description,
      locale: localeOgTag[locale],
      url: canonicalUrl(`/${locale}`),
    },
    twitter: { title: copy.title, description: copy.description },
  }
}

export default async function Page({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return (
    <div
      className={`${landingFontClass} min-h-screen bg-landing font-landing-sans text-white lg:pb-[120px]`}
    >
      <LandingNav locale={locale} />
      <main>
        <LandingHero locale={locale} />
        <LandingProof locale={locale} />
        <LandingOccasions locale={locale} />
        <LandingHow locale={locale} />
        <LandingFaq locale={locale} />
        <LandingFinal locale={locale} />
      </main>
      <LandingFooter locale={locale} />
      <LandingTryCard locale={locale} />
    </div>
  )
}
