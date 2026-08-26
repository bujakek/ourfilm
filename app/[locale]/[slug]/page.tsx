import { ContentArticle } from '@/components/content/content-article'
import { homeLabel } from '@/lib/content/copy'
import { getDocByPath, getDocs } from '@/lib/content/docs'
import { contentMetadata } from '@/lib/content/metadata'
import { isLocale } from '@/lib/i18n'
import type { Crumb } from '@/lib/seo'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

type Props = { params: Promise<{ locale: string; slug: string }> }

/**
 * The money landing pages, served one segment under the locale.
 *
 * `/hu/qr-kod-eskuvoi-fotokhoz` rather than `/hu/megoldasok/qr-kod-…` because
 * that is the address a commercial query expects to land on, and a category
 * segment nobody searches for is a segment that only dilutes the URL.
 *
 * This sits beside `arak`, `blog`, `rolunk` and the rest. Next resolves a
 * static segment ahead of a dynamic one, so none of those routes can be
 * shadowed by a content file — and `dynamicParams = false` means a slug with
 * no MDX behind it 404s rather than rendering an empty page.
 */
export function generateStaticParams({
  params,
}: {
  params: { locale: string }
}) {
  if (!isLocale(params.locale)) return []
  return getDocs(params.locale, ['pages']).map((doc) => ({ slug: doc.slug }))
}

export const dynamicParams = false

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}

  const doc = getDocByPath(locale, `/${slug}`)
  if (!doc) return {}

  return contentMetadata(doc)
}

export default async function SolutionPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()

  const doc = getDocByPath(locale, `/${slug}`)
  if (!doc || doc.kind !== 'pages') notFound()

  const crumbs: Crumb[] = [
    { name: homeLabel[locale], path: '/' },
    { name: doc.title, path: `/${doc.slug}` },
  ]

  return <ContentArticle doc={doc} crumbs={crumbs} />
}
