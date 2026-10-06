import { ChevronLeft } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import { JsonLd } from '@/components/json-ld'
import { LocaleSwitchLink } from '@/components/content/locale-switch-link'
import { coverFor } from '@/lib/content/covers'
import { getTranslations } from '@/lib/content/docs'
import { getFaq } from '@/lib/content/faq'
import { loadDocContent } from '@/lib/content/mdx'
import type { ContentDoc } from '@/lib/content/types'
import { type Locale, localeLabel, localePath } from '@/lib/i18n'
import { CREATE_EVENT_PATH } from '@/lib/routes'
import {
  breadcrumbJsonLd,
  contentJsonLd,
  type Crumb,
  faqJsonLd,
} from '@/lib/seo'
import { siteCopy } from '@/lib/site-copy'
import { cn } from '@/lib/utils'

import { SITE_BUTTON, SITE_CONTAINER } from './layout'
import { PostByline } from './post-byline'
import { proseComponents } from './prose-components'
import { StickyAside } from './sticky-aside'

const labels = {
  en: { all: 'All articles', back: 'Back to the articles' },
  hu: { all: 'Minden cikk', back: 'Vissza a cikkekhez' },
} as const

/**
 * One blog article, whichever of the forty it is.
 *
 * The cover, title and summary sit in a column that stays beside the text on
 * a desktop; on a phone they stack above it. The structured data and the
 * translation link `ContentArticle` wired for every content page are wired
 * here the same way, so the new look costs the article nothing in search.
 */
export async function BlogArticle({
  doc,
  crumbs,
}: {
  doc: ContentDoc
  crumbs: Crumb[]
}) {
  const locale = doc.locale as Locale
  const Content = await loadDocContent(doc.kind, locale, doc.slug)
  const translations = Object.values(getTranslations(doc.id)).filter(
    (ref) => ref.locale !== locale,
  )
  const faq = faqJsonLd(getFaq(doc))
  const copy = labels[locale]
  const blogHref = localePath(locale, '/blog')

  return (
    <article
      className={cn(
        SITE_CONTAINER,
        'pt-[70px] pb-[70px] tab:grid tab:grid-cols-[40%_1fr] tab:items-start tab:gap-[26px] tab:pt-25 tab:pb-25 xl:grid-cols-[39.5%_1fr] xl:gap-10',
      )}
    >
      <JsonLd data={contentJsonLd(doc)} />
      <JsonLd data={breadcrumbJsonLd(locale, crumbs)} />
      {faq ? <JsonLd data={faq} /> : null}

      <StickyAside className="mb-7 border-b border-site-line pb-7 tab:mb-0 tab:border-b-0 tab:pr-5 tab:pb-0 xl:pr-10">
        <Link
          href={blogHref}
          className="mb-5 flex items-center gap-2 text-[14px] text-white transition-colors hover:text-white/70 tab:text-[16px]"
        >
          <ChevronLeft aria-hidden="true" className="size-[15px]" />
          {copy.all}
        </Link>
        <span className="relative mb-5 block aspect-[1.6] overflow-hidden rounded-[16px]">
          <Image
            src={coverFor(doc.id, locale)}
            alt=""
            fill
            priority
            sizes="(min-width: 810px) 40vw, 90vw"
            className="object-cover"
          />
        </span>
        <h1 className="landing-serif mb-2.5 font-landing-display text-[28px] leading-[1.2] text-white tab:text-[30px] xl:text-[38px]">
          {doc.title}
        </h1>
        <p className="text-[16px] leading-[1.5] text-site-muted xl:text-[18px]">
          {doc.description}
        </p>
        <PostByline doc={doc} className="mt-6 flex-wrap tab:mt-[22px]" />
        {/* An article and its translation share no slug, so the navbar's
            language switch cannot reach one. This is the link between them. */}
        {translations.map((ref) => (
          <LocaleSwitchLink
            key={ref.locale}
            href={ref.href}
            locale={ref.locale}
            className="mt-3 inline-block text-[13px] text-site-muted underline underline-offset-4 transition-colors hover:text-white"
          >
            {localeLabel[ref.locale]}
          </LocaleSwitchLink>
        ))}
      </StickyAside>

      <div className="min-w-0 tab:-ml-[26px] tab:border-l tab:border-site-line tab:pl-[26px] xl:-ml-10 xl:pl-10">
        <div className="site-prose">
          <Content components={proseComponents} />
        </div>
        <div className="mt-15 flex flex-col items-stretch gap-5 border-t border-site-line pt-10 text-center text-[16px] tab:flex-row tab:items-center tab:justify-between tab:text-left">
          <Link
            href={blogHref}
            className="transition-colors hover:text-white/70"
          >
            {copy.back}
          </Link>
          <Link
            href={`${CREATE_EVENT_PATH}?lang=${locale}`}
            className={SITE_BUTTON}
          >
            {siteCopy[locale].create}
          </Link>
        </div>
      </div>
    </article>
  )
}
