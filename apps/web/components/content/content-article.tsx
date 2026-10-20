import { Breadcrumbs } from '@/components/content/breadcrumbs'
import { LanguageSwitcher } from '@/components/content/language-switcher'
import { RelatedDocs } from '@/components/content/related-docs'
import { JsonLd } from '@/components/json-ld'
import { SITE_HEADING } from '@/components/pages/layout'
import { proseComponents } from '@/components/pages/prose-components'
import { getTranslations } from '@/lib/content/docs'
import { getFaq } from '@/lib/content/faq'
import { loadDocContent } from '@/lib/content/mdx'
import type { ContentDoc } from '@/lib/content/types'
import { formatPostDate } from '@/lib/format'
import type { Locale } from '@/lib/i18n'
import {
  breadcrumbJsonLd,
  contentJsonLd,
  type Crumb,
  faqJsonLd,
} from '@/lib/seo'
import { cn } from '@/lib/utils'

/**
 * One content page, whichever of the five kinds it is.
 *
 * All four `[slug]` routes render this, so a guide, a landing page and a
 * comparison cannot drift into looking like three different websites — and the
 * structured data, the breadcrumb trail and the "read next" block are wired
 * once rather than four times.
 *
 * Everything is server-rendered. The body is imported and rendered here, so
 * the page is in the HTML a crawler receives with no fetch and no hydration
 * involved.
 */
export async function ContentArticle({
  doc,
  crumbs,
}: {
  doc: ContentDoc
  crumbs: Crumb[]
}) {
  const locale = doc.locale as Locale
  const Content = await loadDocContent(doc.kind, locale, doc.slug)
  const translations = getTranslations(doc.id)
  const faq = faqJsonLd(getFaq(doc))

  return (
    <article className="mx-auto w-[90%] max-w-[800px] pt-[70px] pb-[70px] tab:pt-25 tab:pb-[120px]">
      <div>
        <JsonLd data={contentJsonLd(doc)} />
        <JsonLd data={breadcrumbJsonLd(locale, crumbs)} />
        {faq ? <JsonLd data={faq} /> : null}

        <Breadcrumbs locale={locale} crumbs={crumbs} />

        {/* The single h1. MDX bodies start at `##`, so the heading hierarchy
            below it stays flat and sensible. */}
        <header className="mt-8 border-b border-site-line pb-8 tab:pb-14">
          <h1 className={cn(SITE_HEADING, 'text-balance')}>{doc.title}</h1>
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-site-muted">
            <time dateTime={doc.updatedAt ?? doc.publishedAt}>
              {formatPostDate(doc.updatedAt ?? doc.publishedAt, locale)}
            </time>
            {doc.author ? <span>· {doc.author}</span> : null}
          </div>
          {/* Every kind, blog included. An article and its translation share
              no slug, so the navbar's language toggle cannot reach one — it
              falls back to the homepage for any path it cannot map. This is
              the only link between the two versions a reader has. */}
          <LanguageSwitcher current={locale} translations={translations} />
        </header>

        <div className="site-prose site-prose-info pt-8 tab:pt-14">
          <Content components={proseComponents} />
        </div>

        <RelatedDocs doc={doc} />
      </div>
    </article>
  )
}
