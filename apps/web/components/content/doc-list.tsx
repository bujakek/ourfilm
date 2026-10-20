import { formatPostDate } from '@/lib/format'
import type { ContentDoc } from '@/lib/content/types'
import type { Locale } from '@/lib/i18n'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

/**
 * A shelf of content cards.
 *
 * The same card on every hub, so a guide, an alternative and a comparison read
 * as one library rather than three. `showDate` is off for the commercial pages:
 * a landing page is not news, and stamping it with a date invites a reader to
 * treat it as stale.
 */
export function DocList({
  docs,
  locale,
  showDate = true,
}: {
  docs: ContentDoc[]
  locale: Locale
  showDate?: boolean
}) {
  return (
    <ul className="mt-6 space-y-4">
      {docs.map((doc) => (
        <li key={doc.href}>
          <Link
            href={doc.href}
            className="group flex flex-col rounded-[20px] border border-site-line bg-site-surface p-6 transition-colors hover:border-white/16 tab:p-7"
          >
            {showDate ? (
              <time
                dateTime={doc.updatedAt ?? doc.publishedAt}
                className="text-[13px] text-site-muted"
              >
                {formatPostDate(doc.updatedAt ?? doc.publishedAt, locale)}
              </time>
            ) : null}
            <h3 className="landing-serif mt-3 font-landing-display text-[24px] leading-[1.25] text-balance text-white">
              {doc.title}
            </h3>
            <p className="mt-2 text-[15px] leading-[1.6] text-pretty text-site-muted">
              {doc.description}
            </p>
            <span className="mt-5 inline-flex items-center gap-2 text-[14px] text-site-link-soft">
              {locale === 'en' ? 'Read more' : 'Elolvasom'}
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
