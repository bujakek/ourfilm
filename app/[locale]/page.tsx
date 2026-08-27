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

type Props = { params: Promise<{ locale: string }> }

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
        <Hero />
        <Benefits />
        <HowItWorks />
        <QrPreview />
        <PhotoReveal />
        <Faq />
        <FinalCta />
      </main>
      <Footer locale={locale} />
    </div>
  )
}
