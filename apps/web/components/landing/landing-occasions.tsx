'use client'

import {
  Cake,
  Heart,
  Infinity as InfinityIcon,
  PlaneTakeoff,
  Wine,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'

import { ScreenCamera, ScreenTicket } from '@/components/site/phone-mock'
import type { Locale } from '@/lib/i18n'
import { landingCopy, type LandingOccasionId } from '@/lib/landing-copy'
import { cn } from '@/lib/utils'

import { LANDING_CONTAINER, LANDING_EYEBROW, LANDING_H2 } from './layout'
import { ScaledPhone } from './scaled-phone'
import { OCCASION_PHOTOS } from './screens'

const TABS: { id: LandingOccasionId; Icon: LucideIcon }[] = [
  { id: 'wedding', Icon: Heart },
  { id: 'birthday', Icon: Cake },
  { id: 'travel', Icon: PlaneTakeoff },
  { id: 'party', Icon: Wine },
  { id: 'everyday', Icon: InfinityIcon },
]

/**
 * One product, five kinds of day. A tab changes the quote, the event name on
 * both phones and the photographs on them — nothing else, because nothing
 * else about the product changes either.
 */
export function LandingOccasions({ locale }: { locale: Locale }) {
  const copy = landingCopy[locale].occasions
  const [active, setActive] = useState<LandingOccasionId>('wedding')
  const tab = copy.tabs[active]
  const photos = OCCASION_PHOTOS[active]

  return (
    <section id="occasions" className="pb-[130px] lg:pb-[150px]">
      <div className={LANDING_CONTAINER}>
        <div className="-mx-[9px] rounded-[32px] bg-white/4 px-6 pt-8 pb-6 text-center lg:mx-0 lg:rounded-[54px] lg:px-[70px] lg:pt-[70px] lg:pb-[126px]">
          <p
            className={cn(
              LANDING_EYEBROW,
              'text-[12px] text-white/50 lg:text-[14px]',
            )}
          >
            {copy.eyebrow}
          </p>
          {/* `aria-live`: a tab replaces this line, and the heading is the
              only part of the change a screen reader would otherwise miss —
              the phones are pictures. */}
          <h2
            aria-live="polite"
            className={cn(
              LANDING_H2,
              'mt-4 text-[24px] leading-[1.2] lg:mt-[22px] lg:text-[42px]',
            )}
          >
            {tab.title.map((line) => (
              <span key={line} className="lg:block">
                {line}{' '}
              </span>
            ))}
          </h2>

          <div className="mt-8 flex flex-wrap justify-center gap-[7px] lg:mt-[46px] lg:gap-[11px]">
            {TABS.map(({ id, Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={active === id}
                onClick={() => setActive(id)}
                className={cn(
                  'flex h-10 items-center gap-2 rounded-[14px] px-2.5 text-[13px] text-white transition-colors lg:pr-3 lg:pl-3.5 lg:text-[14px]',
                  active === id
                    ? 'bg-white/10'
                    : 'bg-white/6 text-white/70 hover:bg-white/8 hover:text-white',
                )}
              >
                <Icon
                  aria-hidden="true"
                  className="size-4 shrink-0"
                  strokeWidth={1.5}
                />
                {copy.tabs[id].label}
              </button>
            ))}
          </div>

          <div className="mx-auto mt-[42px] grid max-w-[808px] grid-cols-2 gap-[5px] lg:mt-[43px] lg:w-[70%] lg:gap-2.5">
            <ScaledPhone maxScale={1.6}>
              <ScreenTicket
                locale={locale}
                name={tab.screenName}
                photos={photos}
              />
            </ScaledPhone>
            <ScaledPhone maxScale={1.6}>
              <ScreenCamera
                locale={locale}
                name={tab.screenName}
                photos={photos}
              />
            </ScaledPhone>
          </div>
        </div>
      </div>
    </section>
  )
}
