'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  ScreenCamera,
  ScreenReveal,
  ScreenTicket,
} from '@/components/site/phone-mock'
import type { Locale } from '@/lib/i18n'
import { landingCopy } from '@/lib/landing-copy'
import { cn } from '@/lib/utils'

import {
  LANDING_CONTAINER,
  LANDING_EYEBROW,
  LANDING_H2,
  LANDING_H2_SIZE,
} from './layout'
import { ScaledPhone } from './scaled-phone'

const SCREENS = [ScreenReveal, ScreenTicket, ScreenCamera]

/**
 * The three steps, each on the screen a host or guest actually sees at that
 * step. Three cards side by side on a desktop; on a phone a row that swipes,
 * with arrows for anyone who does not know it does.
 */
export function LandingHow({ locale }: { locale: Locale }) {
  const copy = landingCopy[locale].how
  const rowRef = useRef<HTMLOListElement>(null)
  const [edges, setEdges] = useState({ start: true, end: false })

  const measure = useCallback(() => {
    const row = rowRef.current
    if (!row) return
    const max = row.scrollWidth - row.clientWidth
    setEdges({ start: row.scrollLeft < 2, end: row.scrollLeft > max - 2 })
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  const step = (direction: 1 | -1) => {
    const row = rowRef.current
    const card = row?.firstElementChild
    if (!row || !card) return
    row.scrollBy({
      left: direction * (card.getBoundingClientRect().width + 12),
      behavior: 'smooth',
    })
  }

  const arrow =
    'absolute top-[190px] z-10 flex size-10 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur-md transition-opacity lg:hidden'

  return (
    <section id="how-it-works" className="scroll-mt-20 pb-16 lg:pb-[137px]">
      <div className={LANDING_CONTAINER}>
        <div className="text-center lg:text-left">
          <p className={cn(LANDING_EYEBROW, 'text-white/50')}>{copy.eyebrow}</p>
          <h2 className={cn(LANDING_H2, LANDING_H2_SIZE, 'mt-4 lg:mt-6')}>
            {copy.title}
          </h2>
        </div>
      </div>

      <div className="relative mx-auto max-w-[1440px] lg:px-[min(5vw,72px)]">
        <ol
          ref={rowRef}
          onScroll={measure}
          className="mt-10 flex snap-x snap-mandatory scroll-px-5 scrollbar-none gap-3 overflow-x-auto px-5 lg:mt-[42px] lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0"
        >
          {copy.steps.map(([title, body], i) => {
            const Screen = SCREENS[i]
            return (
              <li
                key={title}
                className="flex w-[276px] shrink-0 snap-start flex-col rounded-[26px] bg-white/5 px-7 pt-7 pb-[21px] lg:w-auto lg:rounded-[32px] lg:bg-white/4 lg:p-8"
              >
                <p className={cn(LANDING_EYEBROW, 'text-white/50')}>
                  {copy.step(i + 1)}
                </p>
                <ScaledPhone
                  maxScale={1}
                  className="mx-auto mt-[22px] w-[144px] lg:mt-[22px] lg:w-[65.5%] lg:max-w-[236px]"
                >
                  <Screen locale={locale} />
                </ScaledPhone>
                <h3 className="mt-7 text-[18px] leading-[1.2] text-white/90 lg:mt-[22px] lg:text-[20px]">
                  {title}
                </h3>
                <p className="mt-2 text-[14px] leading-[1.6] text-white/60 lg:mt-2.5 lg:text-[16px]">
                  {body}
                </p>
              </li>
            )
          })}
        </ol>

        <button
          type="button"
          aria-label={copy.previous}
          onClick={() => step(-1)}
          disabled={edges.start}
          className={cn(arrow, 'left-3', edges.start && 'opacity-0')}
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
        <button
          type="button"
          aria-label={copy.next}
          onClick={() => step(1)}
          disabled={edges.end}
          className={cn(arrow, 'right-3', edges.end && 'opacity-0')}
        >
          <ChevronRight aria-hidden="true" className="size-5" />
        </button>
      </div>

      <p
        aria-hidden="true"
        className={cn(
          LANDING_EYEBROW,
          'mt-6 flex items-center justify-center gap-1 text-white/50 lg:hidden',
        )}
      >
        {copy.swipe}
        <ChevronRight className="size-3.5" />
      </p>
    </section>
  )
}
