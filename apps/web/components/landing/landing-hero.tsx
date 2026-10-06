import Link from 'next/link'

import type { Locale } from '@/lib/i18n'
import { landingCopy } from '@/lib/landing-copy'
import { CREATE_EVENT_PATH } from '@/lib/routes'
import { cn } from '@/lib/utils'

import { LANDING_CONTAINER } from './layout'
import { PhoneDuo } from './phone-duo'
import { WEEKEND_PHOTOS } from './screens'

/** The landing's white call to action: the hero's and the nav's. */
export const LANDING_PRIMARY_BUTTON =
  'inline-flex h-12 min-w-[180px] items-center justify-center rounded-[16px] bg-white px-[18px] text-[14px] font-medium whitespace-nowrap text-landing-ink transition-colors hover:bg-white/90 lg:h-14 lg:min-w-[190px] lg:px-[22px] lg:text-[16px]'

/**
 * The headline, one sentence under it, one button — and the product.
 *
 * The two phones are the host's console and a guest's camera for the same
 * weekend, because that is the whole claim: one event, two sides of it. On a
 * desktop they fill the column beside the copy; on a phone they tilt under
 * the button and run off both edges.
 */
export function LandingHero({ locale }: { locale: Locale }) {
  const copy = landingCopy[locale].hero

  return (
    <section
      id="top"
      className="relative overflow-x-clip pt-[100px] lg:pt-[72px]"
    >
      <div
        className={cn(
          LANDING_CONTAINER,
          'lg:grid lg:grid-cols-[30.8%_1fr] lg:gap-y-9',
        )}
      >
        <h1 className="landing-serif mx-auto max-w-[270px] text-center font-landing-display text-[34px] leading-[1.2] text-white lg:col-span-2 lg:mx-0 lg:max-w-none lg:text-left lg:text-[54px] lg:leading-[1.1]">
          {copy.titleLines.map((line) => (
            <span key={line} className="lg:block">
              {line}{' '}
            </span>
          ))}
        </h1>

        <div className="mt-4 flex flex-col items-center px-5 text-center lg:mt-0 lg:items-start lg:px-0 lg:text-left">
          <p className="max-w-[400px] text-[14px] leading-[1.6] text-pretty text-white/60 lg:text-[16px]">
            {copy.lead}
          </p>
          <Link
            href={`${CREATE_EVENT_PATH}?lang=${locale}`}
            className={cn(LANDING_PRIMARY_BUTTON, 'mt-[22px] lg:mt-[26px]')}
          >
            {copy.create}
          </Link>
        </div>

        <PhoneDuo
          locale={locale}
          name={copy.screenName}
          photos={WEEKEND_PHOTOS}
          maxScale={2}
          className="hidden w-full lg:block"
        />
      </div>

      {/* The phone composition: the same pair, tilted 13° and wider than the
          screen, so each phone is cut by an edge the way a hand holds one. */}
      <div className="mt-[65px] h-[545px] lg:hidden">
        <PhoneDuo
          locale={locale}
          name={copy.screenName}
          photos={WEEKEND_PHOTOS}
          maxScale={1.2}
          className="relative left-1/2 w-[485px] -translate-x-1/2 rotate-[13deg]"
        />
      </div>
    </section>
  )
}
