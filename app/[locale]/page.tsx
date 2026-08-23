import { BackgroundGlow } from '@/components/site/background-glow'
import { Benefits } from '@/components/site/benefits'
import { Faq } from '@/components/site/faq'
import { FinalCta } from '@/components/site/final-cta'
import { Footer } from '@/components/site/footer'
import { Hero } from '@/components/site/hero'
import { HowItWorks } from '@/components/site/how-it-works'
import { InstantAccess } from '@/components/site/instant-access'
import { LiveDemo } from '@/components/site/live-demo'
import { Navbar } from '@/components/site/navbar'
import { Occasions } from '@/components/site/occasions'
import { PhotoQuality } from '@/components/site/photo-quality'
import { QrPreview } from '@/components/site/qr-preview'
import { Stats } from '@/components/site/stats'
import { Testimonials } from '@/components/site/testimonials'
import { isLocale } from '@/lib/i18n'
import { notFound } from 'next/navigation'

/**
 * The sample album in <LiveDemo /> is read from the database, so the page is
 * revalidated rather than fully static. An hour is plenty: the album is
 * seeded, not user-generated, and changes only when someone re-runs the seed.
 */
export const revalidate = 3600

type Props = { params: Promise<{ locale: string }> }

export default async function Page({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return (
    <div className="relative min-h-screen">
      <BackgroundGlow />
      <Navbar locale={locale} />
      <main className="relative z-10">
        <Hero />
        <Stats />
        <Benefits />
        <Testimonials />
        <Occasions locale={locale} />
        <LiveDemo />
        <HowItWorks />
        <QrPreview />
        <PhotoQuality />
        <InstantAccess />
        <Faq />
        <FinalCta />
      </main>
      <Footer locale={locale} />
    </div>
  )
}
