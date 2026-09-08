import { ContentArticle } from '@/components/content/content-article'
import { hubCopy, homeLabel } from '@/lib/content/copy'
import { getDocByPath, getDocs } from '@/lib/content/docs'
import { contentMetadata } from '@/lib/content/metadata'
import { isLocale } from '@/lib/i18n'
import type { Crumb } from '@/lib/seo'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

type Props = { params: Promise<{ locale: string; slug: string }> }

export function generateStaticParams({
  params,
}: {
  params: { locale: string }
}) {
  if (!isLocale(params.locale)) return []
  return getDocs(params.locale, ['alternatives']).map((doc) => ({
    slug: doc.slug,
  }))
}

export const dynamicParams = false

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}

  const doc = getDocByPath(locale, `/alternativak/${slug}`)
  if (!doc) return {}

  return contentMetadata(doc)
}

export default async function AlternativePage({ params }: Props) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()

  const doc = getDocByPath(locale, `/alternativak/${slug}`)
  if (!doc) notFound()

  const crumbs: Crumb[] = [
    { name: homeLabel[locale], path: '/' },
    { name: hubCopy[locale].alternativak.label, path: '/alternativak' },
    { name: doc.title, path: `/alternativak/${doc.slug}` },
  ]

  return <ContentArticle doc={doc} crumbs={crumbs} />
}
