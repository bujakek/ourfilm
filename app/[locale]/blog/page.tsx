import { DocList } from '@/components/content/doc-list'
import { HubLinks } from '@/components/content/hub-links'
import { PageHeader } from '@/components/site/page-header'
import { hubCopy } from '@/lib/content/copy'
import { getDocsByTopic } from '@/lib/content/docs'
import { topicLabel, topicOrder } from '@/lib/content/topics'
import { isLocale, localePath } from '@/lib/i18n'
import { canonicalUrl } from '@/lib/seo'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}

  const path = localePath(locale, '/blog')
  const copy = hubCopy[locale].blog

  return {
    title: `${copy.title} — OurFilm`,
    description: copy.lead,
    alternates: {
      canonical: canonicalUrl(path),
      types: {
        'application/rss+xml': canonicalUrl(`${path}/rss.xml`),
      },
    },
  }
}

/**
 * Shelved by topic rather than listed by date.
 *
 * Forty-odd guides in one reverse-chronological column is a column nobody
 * reads past the fold of, and the newest article is rarely the one a reader
 * arrived for. The shelves come from each article's own `topic`, so the index
 * needs no registry — see `lib/content/topics.ts`.
 */
export default async function BlogIndexPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const shelves = getDocsByTopic(locale)
  const copy = hubCopy[locale].blog

  return (
    <>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} lead={copy.lead} />

      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-3xl">
          {shelves.size === 0 ? (
            <p className="mt-12 leading-relaxed text-muted-foreground">
              {locale === 'en'
                ? 'No articles yet. Check back soon.'
                : 'Még nincs bejegyzés. Hamarosan.'}
            </p>
          ) : (
            topicOrder
              .filter((topic) => shelves.has(topic))
              .map((topic) => (
                <section key={topic} className="mt-14 first:mt-8">
                  <h2 className="text-2xl font-semibold tracking-tight text-balance">
                    {topicLabel[locale][topic].title}
                  </h2>
                  <p className="mt-2 leading-relaxed text-pretty text-muted-foreground">
                    {topicLabel[locale][topic].lead}
                  </p>
                  <DocList docs={shelves.get(topic) ?? []} locale={locale} />
                </section>
              ))
          )}

          <HubLinks locale={locale} current="blog" />
        </div>
      </section>
    </>
  )
}
