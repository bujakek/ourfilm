import { DocList } from '@/components/content/doc-list'
import { HubLinks } from '@/components/content/hub-links'
import { PageHeader } from '@/components/site/page-header'
import { hubCopy } from '@/lib/content/copy'
import { getDocs } from '@/lib/content/docs'
import { isLocale, localePath } from '@/lib/i18n'
import { canonicalUrl } from '@/lib/seo'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}

  const copy = hubCopy[locale].alternativak

  return {
    title: `${copy.title} — OurFilm`,
    description: copy.lead,
    alternates: {
      canonical: canonicalUrl(localePath(locale, '/alternativak')),
    },
  }
}

export default async function AlternativesHubPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const docs = getDocs(locale, ['alternatives'])
  const copy = hubCopy[locale].alternativak

  return (
    <>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} lead={copy.lead} />

      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-3xl">
          {/* Said once, at the top of the shelf, rather than trusted to each
              page: these are our pages about our competitors, not a review. */}
          <p className="glass rounded-2xl px-6 py-4 text-sm leading-relaxed text-muted-foreground">
            {locale === 'en'
              ? 'These comparisons are published by OurFilm, not an independent reviewer. We checked each competitor’s public information on the date shown; pricing and features may have changed since.'
              : 'Ezek az összevetések az OurFilm oldalán jelennek meg, nem független tesztek. A versenytársak nyilvános adatait a megjelöléskor ellenőriztük; az árak és a funkciók azóta változhattak.'}
          </p>

          <DocList docs={docs} locale={locale} showDate={false} />

          <HubLinks locale={locale} current="alternativak" />
        </div>
      </section>
    </>
  )
}
