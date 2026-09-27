'use client'

import {
  ArrowDownToLine,
  Camera,
  ChevronRight,
  Film,
  Loader,
  LockKeyhole,
  Smartphone,
  ThumbsUp,
  Timer,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useState, type ReactNode } from 'react'

import { type Locale, localePath } from '@/lib/i18n'
import { landingCopy } from '@/lib/landing-copy'
import { cn } from '@/lib/utils'

import { LANDING_CONTAINER, LANDING_EYEBROW, LANDING_H2 } from './layout'

/** One per question, in `landingCopy.faq.items` order. */
const ICONS: LucideIcon[] = [
  Camera,
  Smartphone,
  Film,
  UsersRound,
  LockKeyhole,
  Loader,
  ArrowDownToLine,
  ThumbsUp,
  Timer,
]

/**
 * Nine questions as a list of rows that open in place. Several can be open
 * at once: someone comparing two answers should not have to close one to
 * read the other.
 */
export function LandingFaq({ locale }: { locale: Locale }) {
  const copy = landingCopy[locale].faq
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set())

  const toggle = (index: number) =>
    setOpen((current) => {
      const next = new Set(current)
      if (!next.delete(index)) next.add(index)
      return next
    })

  return (
    <section id="faq" className="scroll-mt-20 pb-[115px] lg:pb-[125px]">
      <div className={LANDING_CONTAINER}>
        <div className="text-center lg:text-left">
          <p className={cn(LANDING_EYEBROW, 'text-white/50')}>{copy.eyebrow}</p>
          <h2
            className={cn(
              LANDING_H2,
              'mt-4 text-[30px] leading-[1.2] lg:mt-6 lg:text-[42px]',
            )}
          >
            {copy.title}
          </h2>
        </div>

        <ul className="mt-10 flex flex-col gap-1.5 lg:mt-[50px] lg:gap-[18px]">
          {copy.items.map(([question, answer], i) => {
            const Icon = ICONS[i]
            const isOpen = open.has(i)
            return (
              <li
                key={question}
                className={cn(
                  'rounded-[16px] transition-colors',
                  isOpen ? 'bg-landing-raised' : 'hover:bg-white/4',
                )}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${i}`}
                  onClick={() => toggle(i)}
                  className="flex min-h-[60px] w-full items-center gap-4 rounded-[16px] px-1 text-left lg:px-4"
                >
                  <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[8px] bg-white/6">
                    <Icon
                      aria-hidden="true"
                      className="size-3.5 text-white/50"
                      strokeWidth={1.6}
                    />
                  </span>
                  <span className="flex-1 text-[16px] leading-[1.4] text-white/90 lg:text-[18px] lg:text-white/80">
                    {question}
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className={cn(
                      'size-4 shrink-0 text-white/40 transition-transform',
                      isOpen && 'rotate-90',
                    )}
                  />
                </button>
                <div
                  id={`faq-answer-${i}`}
                  role="region"
                  hidden={!isOpen}
                  className="pr-4 pb-5 pl-[51px] text-[14px] leading-[1.6] text-pretty text-white/60 lg:pl-[66px] lg:text-[16px]"
                >
                  <LinkedAnswer
                    text={answer}
                    word={copy.pricingLink}
                    href={localePath(locale, '/arak')}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

/** Turns the last mention of "Pricing" in an answer into the link to it. */
function LinkedAnswer({
  text,
  word,
  href,
}: {
  text: string
  word: string
  href: string
}): ReactNode {
  const at = text.lastIndexOf(word)
  if (at === -1) return text
  return (
    <>
      {text.slice(0, at)}
      <Link
        href={href}
        className="text-white underline underline-offset-4 hover:text-white/80"
      >
        {word}
      </Link>
      {text.slice(at + word.length)}
    </>
  )
}
