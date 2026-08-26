import { Breadcrumbs } from '@/components/content/breadcrumbs'
import { LanguageSwitcher } from '@/components/content/language-switcher'
import { RelatedDocs } from '@/components/content/related-docs'
import { JsonLd } from '@/components/json-ld'
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
    <article className="relative px-4 pt-32 pb-24 sm:px-6 sm:pt-40 lg:pb-32">
      <div className="mx-auto max-w-3xl">
        <JsonLd data={contentJsonLd(doc)} />
        <JsonLd data={breadcrumbJsonLd(locale, crumbs)} />
        {faq ? <JsonLd data={faq} /> : null}

        <Breadcrumbs locale={locale} crumbs={crumbs} />

        {/* The single h1. MDX bodies start at `##`, so the heading hierarchy
            below it stays flat and sensible. */}
        <header className="mt-8">
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {doc.title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <time dateTime={doc.updatedAt ?? doc.publishedAt}>
              {formatPostDate(doc.updatedAt ?? doc.publishedAt, locale)}
            </time>
            {doc.author ? <span>· {doc.author}</span> : null}
          </div>
          <LanguageSwitcher current={locale} translations={translations} />
        </header>

        <Content />

        <RelatedDocs doc={doc} />
      </div>
    </article>
  )
}
