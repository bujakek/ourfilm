import { PageHeader } from '@/components/site/page-header'
import { getPosts } from '@/lib/blog/posts'
import { formatPostDate } from '@/lib/format'
import { isLocale, type Locale, localePath } from '@/lib/i18n'
import { canonicalUrl } from '@/lib/seo'
import { ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

type Props = { params: Promise<{ locale: string }> }

/** Copy per locale, so the index needs no dictionary infrastructure for what
 *  is currently four strings. When a third locale arrives this is the thing to
 *  promote into one. */
const COPY: Record<
  Locale,
  { title: string; eyebrow: string; lead: string; empty: string; more: string }
> = {
  hu: {
    eyebrow: 'BLOG',
    title: 'Gyakorlati tippek eseményekhez',
    lead: 'Gyakorlati ötletek ahhoz, hogy a vendégeid fotói egy közös albumba kerüljenek.',
    empty: 'Még nincs bejegyzés. Hamarosan.',
    more: 'Elolvasom',
  },
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}

  const path = localePath(locale, '/blog')

  return {
    title: `${COPY[locale].title} — OurFilm`,
    description: COPY[locale].lead,
    alternates: {
      canonical: canonicalUrl(path),
      types: {
        'application/rss+xml': canonicalUrl(`${path}/rss.xml`),
      },
    },
  }
}

export default async function BlogIndexPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const posts = getPosts(locale)
  const copy = COPY[locale]

  return (
    <>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} lead={copy.lead} />

      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-3xl">
          {posts.length === 0 ? (
            <p className="mt-12 leading-relaxed text-muted-foreground">
              {copy.empty}
            </p>
          ) : (
            <ul className="mt-12 space-y-4">
              {posts.map((post) => (
                <li key={post.slug}>
                  <Link
                    href={post.href}
                    className="glass glass-hover group flex flex-col rounded-3xl p-7"
                  >
                    <time
                      dateTime={post.publishedAt}
                      className="text-xs tracking-wide text-muted-foreground"
                    >
                      {formatPostDate(post.publishedAt, locale)}
                    </time>
                    <h2 className="mt-3 text-xl font-semibold text-balance">
                      {post.title}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
                      {post.description}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-accent">
                      {copy.more}
                      <ArrowRight
                        className="size-4 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  )
}
