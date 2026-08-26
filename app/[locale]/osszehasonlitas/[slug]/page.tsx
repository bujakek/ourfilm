import { ContentArticle } from '@/components/content/content-article'
import { hubCopy, homeLabel } from '@/lib/content/copy'
import { getDocByPath, getDocs } from '@/lib/content/docs'
import { contentMetadata } from '@/lib/content/metadata'
import { hubKinds } from '@/lib/content/kinds'
import { isLocale } from '@/lib/i18n'
import type { Crumb } from '@/lib/seo'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

type Props = { params: Promise<{ locale: string; slug: string }> }

/**
 * Both comparison kinds, one route.
 *
 * `vs` (OurFilm against someone) and `compare` (two other products against
 * each other) share this URL space on purpose — see `lib/content/kinds.ts`.
 * The lookup is by path rather than by kind precisely so this route never has
 * to guess which directory a slug came from.
 */
export function generateStaticParams({
  params,
}: {
  params: { locale: string }
}) {
  if (!isLocale(params.locale)) return []
  return getDocs(params.locale, hubKinds.osszehasonlitas).map((doc) => ({
    slug: doc.slug,
  }))
}

export const dynamicParams = false

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}

  const doc = getDocByPath(locale, `/osszehasonlitas/${slug}`)
  if (!doc) return {}

  return contentMetadata(doc)
}

export default async function ComparisonPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()

  const doc = getDocByPath(locale, `/osszehasonlitas/${slug}`)
  if (!doc) notFound()

  const crumbs: Crumb[] = [
    { name: homeLabel[locale], path: '/' },
    { name: hubCopy[locale].osszehasonlitas.label, path: '/osszehasonlitas' },
    { name: doc.title, path: `/osszehasonlitas/${doc.slug}` },
  ]

  return <ContentArticle doc={doc} crumbs={crumbs} />
}
