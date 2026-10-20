import { getRelatedDocs } from '@/lib/content/docs'
import type { ContentDoc } from '@/lib/content/types'
import type { Locale } from '@/lib/i18n'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

const HEADING: Record<Locale, string> = {
  en: 'Related pages',
  hu: 'Kapcsolódó oldalak',
}

/**
 * "Read next", driven by the `related` ids in frontmatter.
 *
 * Ids rather than URLs, so a link keeps working when the page is translated
 * and its slug changes language — and so a guide can point at a landing page
 * without either of them knowing the other's directory. Resolution is
 * same-locale only: a Hungarian reader is never sent to an English page.
 */
export function RelatedDocs({ doc }: { doc: ContentDoc }) {
  const related = getRelatedDocs(doc)
  if (related.length === 0) return null

  const locale = doc.locale as Locale

  return (
    <section className="mt-16 border-t border-site-line pt-10">
      <h2 className="landing-serif font-landing-display text-[24px] leading-[1.25] text-white">
        {HEADING[locale]}
      </h2>
      <ul className="mt-4 space-y-3">
        {related.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="group flex items-center justify-between gap-4 rounded-[20px] border border-site-line bg-site-surface px-5 py-4 transition-colors hover:border-white/16"
            >
              <span className="min-w-0">
                <span className="block text-[16px] font-medium text-balance text-white">
                  {item.title}
                </span>
                <span className="mt-1 block text-[14px] leading-[1.5] text-site-muted">
                  {item.description}
                </span>
              </span>
              <ArrowRight
                className="size-4 shrink-0 text-site-link-soft transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
