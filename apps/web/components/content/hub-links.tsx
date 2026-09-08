import { hubCopy, solutionsLabel } from '@/lib/content/copy'
import { getDocs } from '@/lib/content/docs'
import { type Hub, hubs } from '@/lib/content/kinds'
import { type Locale, localePath } from '@/lib/i18n'
import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

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
    <section className="mt-20 border-t border-border pt-12">
      <h2 className="text-xl font-semibold tracking-tight">
        {solutionsLabel[locale].title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {solutionsLabel[locale].lead}
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {solutions.map((doc) => (
          <li key={doc.href}>
            <Link
              href={doc.href}
              className="glass glass-hover flex min-h-16 items-center rounded-2xl px-5 py-4 text-sm font-medium text-balance"
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
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          >
            {hubCopy[locale][hub].label}
            <ArrowUpRight className="size-4 text-accent" aria-hidden="true" />
          </Link>
        ))}
      </nav>
    </section>
  )
}
