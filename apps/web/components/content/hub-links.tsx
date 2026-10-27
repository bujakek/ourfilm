import { hubCopy, solutionsLabel } from '@/lib/content/copy'
import { getDocs } from '@/lib/content/docs'
import { type Hub, hubs } from '@/lib/content/kinds'
import { type Locale, localePath } from '@/lib/i18n'
import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

/**
 * The foot of every hub: the other hubs, and every money landing page.
 *
 * The landing pages have no hub of their own — a landing page is an entry
 * point, not something anyone browses a list of — so this is what keeps them
 * off the orphan list. Three hubs each linking all eight means a crawler
 * reaches every one of them from anywhere in the library, and a reader who
 * arrived on a guide has somewhere to go that answers their actual question.
 */
export function HubLinks({
  locale,
  current,
}: {
  locale: Locale
  current: Hub
}) {
  const others = hubs.filter((hub) => hub !== current)
  const solutions = getDocs(locale, ['pages'])

  return (
    <section className="mt-20 border-t border-site-line pt-12">
      <h2 className="landing-serif font-landing-display text-[26px] leading-[1.25] text-white">
        {solutionsLabel[locale].title}
      </h2>
      <p className="mt-2 text-[15px] leading-[1.6] text-site-muted">
        {solutionsLabel[locale].lead}
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {solutions.map((doc) => (
          <li key={doc.href}>
            <Link
              href={doc.href}
              className="flex min-h-16 items-center rounded-[20px] border border-site-line bg-site-surface px-5 py-4 text-[15px] font-medium text-balance text-white transition-colors hover:border-white/16"
            >
              {doc.title}
            </Link>
          </li>
        ))}
      </ul>

      <nav
        className="mt-10 flex flex-wrap gap-3"
        aria-label={locale === 'en' ? 'More resources' : 'További listák'}
      >
        {others.map((hub) => (
          <Link
            key={hub}
            href={localePath(locale, `/${hub}`)}
            className="inline-flex min-h-11 items-center gap-2 rounded-[16px] bg-white/8 px-5 text-[14px] font-medium text-white transition-colors hover:bg-white/12"
          >
            {hubCopy[locale][hub].label}
            <ArrowUpRight
              className="size-4 text-site-link-soft"
              aria-hidden="true"
            />
          </Link>
        ))}
      </nav>
    </section>
  )
}
