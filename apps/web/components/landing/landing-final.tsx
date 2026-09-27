import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

import { ScreenCamera, ScreenTicket } from '@/components/site/phone-mock'
import type { Locale } from '@/lib/i18n'
import { landingCopy } from '@/lib/landing-copy'
import { CREATE_EVENT_PATH } from '@/lib/routes'
import { cn } from '@/lib/utils'

import { LANDING_CONTAINER } from './layout'
import { ScaledPhone } from './scaled-phone'
import { WEEKEND_PHOTOS } from './screens'

/**
 * The last ask. The page's only sky-blue button, so it reads as the end of
 * the page rather than one more white CTA, over the same two screens the hero
 * opened with — on a phone, just the guest's, tilted.
 */
export function LandingFinal({ locale }: { locale: Locale }) {
  const copy = landingCopy[locale].final

  return (
    <section className="overflow-x-clip pb-10 lg:pb-[104px]">
      <div className={cn(LANDING_CONTAINER, 'lg:text-center')}>
        <h2 className="landing-serif font-landing-display text-[28px] leading-[1.4] text-white lg:text-[52px]">
          {copy.titleLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h2>
        <Link
          href={`${CREATE_EVENT_PATH}?lang=${locale}`}
          className="mt-6 inline-flex h-[46px] items-center gap-2.5 rounded-[16px] bg-landing-sky pr-4 pl-[18px] text-[14px] font-medium text-black transition-colors hover:bg-landing-sky/85 lg:mt-[25px] lg:h-[52px] lg:pr-[18px] lg:pl-[22px] lg:text-[16px]"
        >
          {copy.create}
          <ArrowRight aria-hidden="true" className="size-4" strokeWidth={2} />
        </Link>

        <div className="mx-auto mt-[50px] hidden max-w-[1114px] grid-cols-2 lg:grid">
          <ScaledPhone maxScale={1.4} className="mx-auto w-[63%]">
            <ScreenTicket
              locale={locale}
              name={copy.screenName}
              photos={WEEKEND_PHOTOS}
            />
          </ScaledPhone>
          <ScaledPhone maxScale={1.4} className="mx-auto w-[63%]">
            <ScreenCamera
              locale={locale}
              name={copy.screenName}
              photos={WEEKEND_PHOTOS}
            />
          </ScaledPhone>
        </div>
      </div>

      <div className="mt-[42px] lg:hidden">
        <ScaledPhone
          maxScale={1.3}
          className="relative left-1/2 w-[315px] -translate-x-1/2 rotate-[15deg]"
        >
          <ScreenCamera
            locale={locale}
            name={copy.screenName}
            photos={WEEKEND_PHOTOS}
          />
        </ScaledPhone>
      </div>
    </section>
  )
}
