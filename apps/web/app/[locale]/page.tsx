import { PageGrain } from '@/components/site/page-grain'
import { Faq } from '@/components/site/faq'
import { FinalCta } from '@/components/site/final-cta'
import { Footer } from '@/components/site/footer'
import { Hero } from '@/components/site/hero'
import { HowItWorks } from '@/components/site/how-it-works'
import { Navbar } from '@/components/site/navbar'
import { OccasionPrints } from '@/components/site/occasion-prints'
import { PhotoReveal } from '@/components/site/photo-reveal'
import { Problem } from '@/components/site/problem'
import { QrPreview } from '@/components/site/qr-preview'
import { Testimonials } from '@/components/site/testimonials'
import { TryCameraCard } from '@/components/site/try-camera-card'
import { JsonLd } from '@/components/json-ld'
import { isLocale, localeOgTag } from '@/lib/i18n'
import { marketingCopy } from '@/lib/marketing-copy'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  canonicalUrl,
  faqJsonLd,
  faqPairs,
  localizedPageAlternates,
  organizationJsonLd,
  webSiteJsonLd,
} from '@/lib/seo'

type Props = { params: Promise<{ locale: string }> }

const metadataCopy = {
  en: {
    title: 'OurFilm | Your Wedding, Through Their Eyes',
    description:
      'Give every wedding guest their own digital roll with one QR code. No app, no accounts and no chasing photos after the wedding.',
  },
  hu: {
    title: 'OurFilm | Az esküvőtök, a vendégeitek szemével',
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

  // The same array `<Faq>` renders, so the schema cannot describe a question
  // the page does not ask — the guarantee `lib/content/faq.ts` gets by parsing
  // MDX, this gets for free by sharing the source. Every article on the site
  // already carries `FAQPage`; the homepage asks eight questions in the open
  // and was the one page answering them only to a human reader.
  const faq = faqJsonLd(faqPairs(marketingCopy[locale].faq.items))

  return (
    <div className="editorial-home relative min-h-screen">
      {/* Who OurFilm is, and which language's homepage this is. Rendered here
          rather than in the layout: the layout wraps every public page, and one
          `WebSite` node per article is noise. */}
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={webSiteJsonLd(locale)} />
      {faq ? <JsonLd data={faq} /> : null}
      <PageGrain />
      <Navbar locale={locale} />
      <main className="relative z-10">
        {/* <Stats /> is deliberately not rendered. It only ever held invented
            numbers, and the pilot has no verified ones to put in their place.

            <Benefits /> joins them, for a different reason: it was one heading
            and one sentence, the heading is `footer.tagline` word for word,
            and the sentence is now the supporting line of the step section it
            sat above. Nothing it said has left the page. */}
        <Hero locale={locale} />
        <Testimonials locale={locale} />
        <Problem locale={locale} />
        <HowItWorks locale={locale} />
        <QrPreview locale={locale} />
        <OccasionPrints locale={locale} />
        <PhotoReveal locale={locale} />
        <Faq locale={locale} />
        <FinalCta locale={locale} />
      </main>
      <Footer locale={locale} />
      {/* Outside `<main>`: it is an offer that follows the reader down the
          page, not a part of the document's outline. Desktop only — see the
          component. */}
      <TryCameraCard locale={locale} />
    </div>
  )
}
