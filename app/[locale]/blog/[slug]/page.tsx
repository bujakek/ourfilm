import { LanguageSwitcher } from '@/components/blog/language-switcher'
import { RelatedPosts } from '@/components/blog/related-posts'
import { JsonLd } from '@/components/json-ld'
import { loadPostContent } from '@/lib/blog/mdx'
import { getPost, getPosts, getTranslations } from '@/lib/blog/posts'
import { formatPostDate } from '@/lib/format'
import { isLocale, type Locale, localeOgTag, localePath } from '@/lib/i18n'
import { blogPostingJsonLd, canonicalUrl, languageAlternates } from '@/lib/seo'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

type Props = { params: Promise<{ locale: string; slug: string }> }

/** One entry per published article per enabled locale. Next runs this once for
 *  each locale the parent segment generated, so `params.locale` is already
 *  narrowed to something real. */
export function generateStaticParams({
  params,
}: {
  params: { locale: string }
}) {
  if (!isLocale(params.locale)) return []
  return getPosts(params.locale).map((post) => ({ slug: post.slug }))
}

/** Anything not listed above is not an article. Draft posts are excluded from
 *  `getPosts` in production, so a draft URL 404s in a build and still renders
 *  in `next dev`. */
export const dynamicParams = false

const BACK_LABEL: Record<Locale, string> = {
  hu: 'Minden bejegyzés',
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}

  const post = getPost(locale, slug)
  if (!post) return {}

  const translations = getTranslations(post.id)
  const url = canonicalUrl(post.href)

  return {
    title: `${post.title} — OurFilm`,
    description: post.description,
    alternates: {
      // Each language canonicalises to itself. Pointing one at the other is
      // how a translated page gets dropped from the index.
      canonical: url,
      languages: languageAlternates(translations),
    },
    openGraph: {
      type: 'article',
      url,
      title: post.title,
      description: post.description,
      locale: localeOgTag[locale],
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      ...(post.image ? { images: [{ url: post.image }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      ...(post.image ? { images: [post.image] } : {}),
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()

  const post = getPost(locale, slug)
  if (!post) notFound()

  // The body is imported and rendered here, on the server — the article is in
  // the HTML a crawler receives, with no fetch and no hydration involved.
  const Content = await loadPostContent(locale, slug)
  const translations = getTranslations(post.id)

  return (
    <article className="relative px-4 pt-32 pb-24 sm:px-6 sm:pt-40 lg:pb-32">
      <div className="mx-auto max-w-3xl">
        <JsonLd data={blogPostingJsonLd(post)} />

        <Link
          href={localePath(locale, '/blog')}
          className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {BACK_LABEL[locale]}
        </Link>

        {/* The single h1. MDX bodies start at `##`, so the heading hierarchy
            below it stays flat and sensible. */}
        <header className="mt-8">
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {post.title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <time dateTime={post.publishedAt}>
              {formatPostDate(post.publishedAt, locale)}
            </time>
            {post.author ? <span>· {post.author}</span> : null}
          </div>
          <LanguageSwitcher current={locale} translations={translations} />
        </header>

        <Content />

        <RelatedPosts post={post} />
      </div>
    </article>
  )
}
