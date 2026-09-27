import { OccasionPage } from '@/components/pages/occasion-page'
import { SiteShell } from '@/components/pages/site-shell'
import {
  OCCASIONS_ARE_DRAFT,
  occasionBySlug,
  occasionCopy,
  occasionPath,
  occasions,
} from '@/lib/occasions'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { defaultLocale, isLocale, locales, localeTag } from '@/lib/i18n'
import { canonicalUrl } from '@/lib/seo'

type Props = { params: Promise<{ locale: string; occasion: string }> }

/** Four locale-specific slugs, so every canonical page prerenders. */
export function generateStaticParams({
  params,
}: {
  params: { locale: string }
}) {
  const { locale } = params
  if (!isLocale(locale)) return []
  return occasions.map((occasion) => ({
    occasion: occasion.slugs[locale],
  }))
}

export const dynamicParams = false

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, occasion: slug } = await params
  if (!isLocale(locale)) return {}
  const occasion = occasionBySlug(locale, slug)
  if (!occasion) return {}
  const copy = occasionCopy(locale, occasion)

  return {
    title: copy.meta.title,
    description: copy.meta.description,
    alternates: {
      canonical: canonicalUrl(occasionPath(locale, occasion)),
      languages: Object.fromEntries([
        ...locales.map((item) => [
          localeTag[item],
          canonicalUrl(occasionPath(item, occasion)),
        ]),
        ['x-default', canonicalUrl(occasionPath(defaultLocale, occasion))],
      ]),
    },
    openGraph: {
      title: copy.meta.title,
      description: copy.meta.description,
      url: canonicalUrl(occasionPath(locale, occasion)),
    },
    ...(OCCASIONS_ARE_DRAFT ? { robots: { index: false, follow: true } } : {}),
  }
}

/**
 * One occasion. The page itself is `components/pages/occasion-page.tsx`; this
 * route owns what is only a route's business — the static params, the
 * canonical and hreflang set, and the `noindex` lever in `OCCASIONS_ARE_DRAFT`.
 */
export default async function OccasionRoute({ params }: Props) {
  const { locale, occasion: slug } = await params
  if (!isLocale(locale)) notFound()
  const occasion = occasionBySlug(locale, slug)
  if (!occasion) notFound()

  return (
    <SiteShell locale={locale}>
      <OccasionPage locale={locale} occasion={occasion} />
    </SiteShell>
  )
}
