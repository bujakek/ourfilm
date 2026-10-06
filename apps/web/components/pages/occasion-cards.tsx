import { ChevronRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import type { Locale } from '@/lib/i18n'
import { occasionCopy, occasionPath, occasions } from '@/lib/occasions'
import { cn } from '@/lib/utils'

import { SITE_KICKER } from './layout'

const more = { en: 'Take a look', hu: 'Megnézem' } as const

/**
 * The four occasions as cards: a photograph, the label, the page's own
 * headline and a way in. `compact` is the four-across strip under the
 * price; the full cards, two across with their summary, are the index.
 */
export function OccasionCards({
  locale,
  compact = false,
}: {
  locale: Locale
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-[22px] tab:grid-cols-2 tab:gap-6',
        compact && 'tab:gap-5 xl:grid-cols-4',
      )}
    >
      {occasions.map((occasion) => {
        const copy = occasionCopy(locale, occasion)
        return (
          <Link
            key={occasion.id}
            href={occasionPath(locale, occasion)}
            className="flex flex-col overflow-hidden rounded-[28px] border border-site-line bg-site-surface p-2.5 transition-colors hover:border-white/16 tab:p-3"
          >
            <span className="relative block aspect-[1.57] overflow-hidden rounded-[18px]">
              <Image
                src={occasion.image}
                alt={copy.alt}
                fill
                sizes={
                  compact
                    ? '(min-width: 1280px) 300px, (min-width: 810px) 45vw, 90vw'
                    : '(min-width: 810px) 45vw, 90vw'
                }
                className={cn('object-cover', occasion.imagePosition)}
              />
            </span>
            <span
              className={cn(
                'flex flex-1 flex-col px-2.5 pt-5 pb-2.5 tab:pt-[22px] tab:pb-3',
                compact && 'tab:px-1.5 tab:pt-4 tab:pb-2',
              )}
            >
              <span className={cn(SITE_KICKER, 'mb-4 tab:text-[12px]')}>
                {copy.label}
              </span>
              <span
                className={cn(
                  'landing-serif mb-3 font-landing-display text-[28px] leading-[1.2] text-white tab:text-[30px]',
                  compact && 'tab:text-[24px]',
                )}
              >
                {copy.title}
              </span>
              {compact ? null : (
                <span className="mb-5 text-[16px] leading-[1.5] text-site-muted">
                  {copy.text}
                </span>
              )}
              <span className="mt-auto flex items-center gap-2 pt-4 text-[14px] text-site-link-soft">
                {more[locale]}
                <ChevronRight aria-hidden="true" className="size-[13px]" />
              </span>
            </span>
          </Link>
        )
      })}
    </div>
  )
}
