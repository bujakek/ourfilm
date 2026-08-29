import type { Crumb } from '@/lib/seo'
import { type Locale, localePath } from '@/lib/i18n'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'

/**
 * The visible trail the `BreadcrumbList` describes.
 *
 * Rendered rather than emitted as markup alone: structured data that no reader
 * can see is the kind Google discounts, and the trail is also the only way off
 * a page that was landed on straight from a search result.
 *
 * The last crumb is the current page and is not a link.
 */
export function Breadcrumbs({
  locale,
  crumbs,
}: {
  locale: Locale
  crumbs: Crumb[]
}) {
  return (
    <nav aria-label={locale === 'en' ? 'Breadcrumbs' : 'Morzsamenü'}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1
          return (
            <li key={crumb.path} className="flex items-center gap-x-1.5">
              {index > 0 ? (
                <ChevronRight
                  className="size-3.5 shrink-0 opacity-60"
                  aria-hidden="true"
                />
              ) : null}
              {isLast ? (
                <span aria-current="page" className="text-foreground/70">
                  {crumb.name}
                </span>
              ) : (
                <Link
                  href={localePath(locale, crumb.path)}
                  className="transition-colors hover:text-foreground"
                >
                  {crumb.name}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
