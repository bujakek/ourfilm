import Link from 'next/link'

import type { Locale } from '@/lib/i18n'
import { landingCopy } from '@/lib/landing-copy'
import { demoEventUrl } from '@/lib/site'
import { cn } from '@/lib/utils'

import { LANDING_CONTAINER, LANDING_EYEBROW, LANDING_H2 } from './layout'

/**
 * What a host gets, in three numbers, and what three couples said about it.
 *
 * The numbers are the product's own facts rather than usage figures: one
 * album, no app, and the free guest limit the database enforces. The guest
 * demo sits in the same row on a desktop, and after the reviews on a phone,
 * where the row has no room left for it.
 */
export function LandingProof({ locale }: { locale: Locale }) {
  const copy = landingCopy[locale].proof
  const tryLink = (
    <Link
      href={demoEventUrl(locale)}
      className={cn(
        LANDING_EYEBROW,
        'rounded-[6px] px-1 py-[3px] font-bold text-landing-link underline underline-offset-4 transition-colors hover:bg-landing-link/12 lg:bg-landing-link/12 lg:hover:bg-landing-link/20',
      )}
    >
      {copy.tryAsGuest}
    </Link>
  )

  return (
    <section className="pt-[50px] pb-[110px] lg:pt-[90px] lg:pb-[160px]">
      <div className={LANDING_CONTAINER}>
        <h2
          className={cn(
            LANDING_H2,
            'text-center text-[28px] leading-[1.2] lg:text-left lg:text-[42px]',
          )}
        >
          {copy.titleLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h2>

        <div className="mt-10 flex flex-wrap items-end justify-center gap-x-6 gap-y-6 lg:mt-[50px] lg:justify-start lg:gap-x-10">
          <dl className="grid grid-cols-3 gap-x-4 text-center lg:flex lg:gap-x-10 lg:text-left">
            {copy.stats.map(([figure, label]) => (
              <div key={label} className="flex flex-col-reverse">
                <dt
                  className={cn(
                    LANDING_EYEBROW,
                    'mt-2 text-[11px] tracking-[0.2em] text-white lg:text-[14px] lg:tracking-[0.24em]',
                  )}
                >
                  {label}
                </dt>
                <dd className="font-landing-quote text-[32px] leading-[1.2] font-semibold text-white italic lg:text-[38px]">
                  {figure}
                </dd>
              </div>
            ))}
          </dl>
          <div className="hidden pb-px lg:block">{tryLink}</div>
        </div>

        <ul className="mt-14 grid gap-12 text-center lg:mt-[70px] lg:grid-cols-3 lg:gap-15 lg:text-left">
          {copy.reviews.map((review) => (
            <li key={review.name}>
              <figure>
                <p className="font-landing-quote text-[27px] leading-[1.15] font-semibold text-white italic lg:text-[26px]">
                  {review.title}
                </p>
                <blockquote className="mt-3 text-[14px] leading-[1.6] text-pretty text-white/60 lg:mt-4 lg:text-[16px]">
                  {review.quote}
                </blockquote>
                <figcaption className="mt-2 flex items-center justify-center gap-3 text-[14px] leading-[1.6] font-medium text-white lg:mt-4 lg:justify-start">
                  {review.name}
                  <span aria-hidden="true" className="h-3.5 w-px bg-white/20" />
                  {review.place}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>

        <div className="mt-14 text-center lg:hidden">{tryLink}</div>
      </div>
    </section>
  )
}
