import { ContentArticle } from '@/components/content/content-article'
import { hubCopy, homeLabel } from '@/lib/content/copy'
import { getDocByPath, getDocs } from '@/lib/content/docs'
import { contentMetadata } from '@/lib/content/metadata'
import { isLocale } from '@/lib/i18n'
import type { Crumb } from '@/lib/seo'
import type { Metadata } from 'next'
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
  return getDocs(params.locale, ['blog']).map((doc) => ({ slug: doc.slug }))
}

/** Anything not listed above is not an article. Draft posts are excluded from
 *  `getDocs` in production, so a draft URL 404s in a build and still renders
 *  in `next dev`. */
export const dynamicParams = false

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}

  const doc = getDocByPath(locale, `/blog/${slug}`)
  if (!doc) return {}

  return contentMetadata(doc)
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()

  const doc = getDocByPath(locale, `/blog/${slug}`)
  if (!doc || doc.kind !== 'blog') notFound()

  const crumbs: Crumb[] = [
    { name: homeLabel[locale], path: '/' },
    { name: hubCopy[locale].blog.label, path: '/blog' },
    { name: doc.title, path: `/blog/${doc.slug}` },
  ]

  return <ContentArticle doc={doc} crumbs={crumbs} />
}
