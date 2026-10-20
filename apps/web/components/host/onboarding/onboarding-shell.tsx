'use client'

import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  HOST_ICON_BUTTON,
  HOST_KICKER,
  HOST_PAY,
  HOST_PRIMARY,
  HOST_QUESTION,
} from '@/components/host/ui/classes'
import { Odometer } from '@/components/ui/odometer'
import { localeTag, type Locale } from '@/lib/i18n'
import { T, still } from '@/lib/motion'

export type OnboardingNav = {
  step: number
  stepCount: number
  backHref?: string
  onBack?: () => void
  onNext?: () => void
  error?: string | null
}

/**
 * One question, as data.
 *
 * The four screens used to render a shell each. That made the shell a
 * different element on every step, so React tore it down and built a new one —
 * and an `AnimatePresence` that remounts can never play an exit, a counter
 * that remounts can never roll, and a progress rule that remounts is cut and
 * redrawn rather than grown. All three are the elements that are supposed to
 * survive a step change, which is what makes four screens read as one sheet.
 *
 * So the shell is rendered once, above the step, and a step describes itself.
 * Each step file exports a plain function returning this: its own copy, its
 * own CTA, and its fields as a child element that owns whatever hooks it
 * needs.
 */
export type StepScreen = {
  eyebrow: string
  title: string
  detail?: string
  cta: string
  ctaDisabled?: boolean
  ctaPending?: boolean
  /** `pay` paints the CTA sky: it is the button on the way to a payment. */
  ctaTone?: 'pay'
  note?: ReactNode
  /** Small print under the CTA — the free path's terms line. */
  footnote?: ReactNode
  content: ReactNode
}

/**
 * One question per screen, in the landing look (6a–6d).
 *
 * - **A kicker naming the thing being decided**, then the question in Roboto
 *   Serif, left aligned, and an optional lead line.
 * - **A step counter and a rule instead of dots.** `1 / 4` in the figure face
 *   says where you are; the rule beside the CTA is the same information as a
 *   shape. The dots' accessible equivalent survives verbatim below — a
 *   visually hidden ordered list carrying `aria-current`.
 * - **One white action.** The CTA is `HOST_PRIMARY`, or sky `HOST_PAY` on the
 *   way to a payment, pinned to the bottom.
 *
 * The page scrolls as a whole and the footer is sticky, rather than the
 * question scrolling inside a fixed frame: a floating panel (the end screen's
 * month) is absolute, and an inner scroller would clip it.
 */
export function OnboardingShell({
  eyebrow,
  title,
  detail,
  step,
  stepCount,
  backHref,
  onBack,
  cta,
  ctaDisabled = false,
  ctaPending = false,
  ctaTone,
  onNext,
  error = null,
  note = null,
  footnote = null,
  children,
  locale = 'hu',
}: {
  /** Names the thing being decided. One to three words. */
  eyebrow: string
  title: string
  /** Optional lead line below the question. */
  detail?: string
  step: number
  stepCount: number
  backHref?: string
  onBack?: () => void
  cta: string
  ctaDisabled?: boolean
  ctaPending?: boolean
  ctaTone?: 'pay'
  onNext?: () => void
  error?: string | null
  note?: ReactNode
  footnote?: ReactNode
  children: ReactNode
  locale?: Locale
}) {
  const spent = useRef<number | null>(null)
  useEffect(() => {
    spent.current = null
  }, [step, ctaPending])

  const blocked = ctaDisabled || ctaPending
  const en = locale === 'en'
  const reduceMotion = useReducedMotion()

  // Which way the flow is travelling, adjusted during render the way React
  // documents for state derived from props. The shell is the only thing that
  // sees both the old step and the new one, so deriving it here leaves all
  // four screens unchanged — none of them has to know it is going backwards.
  const [seen, setSeen] = useState(step)
  const [dir, setDir] = useState(1)
  if (seen !== step) {
    setDir(step > seen ? 1 : -1)
    setSeen(step)
  }

  // Forward and back are mirror images: the question leaves toward the
  // direction of travel and the next one arrives from the opposite side. It
  // leaves on `exit` and arrives on `settle`, because a screen being replaced
  // should get out of the way faster than its replacement takes to land.
  const question = useMemo(
    () => ({
      enter: (d: number) => ({ opacity: 0, x: d * 16 }),
      center: {
        opacity: 1,
        x: 0,
        transition: reduceMotion ? still : T.settle,
      },
      exit: (d: number) => ({
        opacity: 0,
        x: d * -16,
        transition: reduceMotion ? still : T.exit,
      }),
    }),
    [reduceMotion],
  )

  return (
    <div
      className="flex min-h-[100dvh] flex-col px-5 pt-[calc(1.25rem+env(safe-area-inset-top))]"
      // Every step of the create flow renders through this shell, so marking
      // the language here covers the whole flow. See `app/(product)/layout.tsx`.
      lang={localeTag[locale]}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <header className="flex items-center justify-between">
          {backHref ? (
            <Link
              href={backHref}
              aria-label={en ? 'Back to events' : 'Vissza az eseményekhez'}
              className={HOST_ICON_BUTTON}
            >
              <ArrowLeft className="size-[19px]" aria-hidden="true" />
            </Link>
          ) : (
            <motion.button
              type="button"
              onClick={onBack}
              whileTap={reduceMotion ? undefined : { scale: 0.94 }}
              transition={reduceMotion ? still : T.snap}
              aria-label={
                en
                  ? 'Back to the previous question'
                  : 'Vissza az előző kérdéshez'
              }
              className={HOST_ICON_BUTTON}
            >
              <ArrowLeft className="size-[19px]" aria-hidden="true" />
            </motion.button>
          )}

          {/* The counter is what a host reads; the list under it is what a
              screen reader gets. */}
          <p
            aria-hidden="true"
            className="host-figure flex items-center text-[22px] leading-none text-white/65"
          >
            <Odometer value={step + 1} dir={dir > 0 ? 'up' : 'down'} />
            <span className="px-1.5">/</span>
            {stepCount}
          </p>
          <ol aria-label={en ? 'Steps' : 'Lépések'} className="sr-only">
            {Array.from({ length: stepCount }, (_, i) => (
              <li key={i} aria-current={i === step ? 'step' : undefined}>
                {en
                  ? `Step ${i + 1}${i === step ? ' — current' : ''}`
                  : `${i + 1}. lépés${i === step ? ' — jelenlegi' : ''}`}
              </li>
            ))}
          </ol>
        </header>

        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={question}
            initial="enter"
            animate="center"
            exit="exit"
            className="flex flex-1 flex-col"
          >
            <div className="mt-9">
              <p className={HOST_KICKER}>{eyebrow}</p>
              <h1 className={`mt-3.5 ${HOST_QUESTION}`}>{title}</h1>
              {detail ? (
                <p className="mt-3.5 max-w-[20rem] text-[15px] leading-[1.6] text-pretty text-white/65">
                  {detail}
                </p>
              ) : null}
            </div>

            <div className="mt-7 flex flex-1 flex-col">{children}</div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Sticky rather than fixed: it sits in the flow at the bottom of a
          short screen and stays reachable over a long one. A fade rather
          than a fill, so the page grain carries on under it; the fade is all
          in the top padding, and the footer's own text sits on ground that
          is at least 90% opaque. */}
      <div className="sticky bottom-0 z-10 -mx-5 mt-2 bg-gradient-to-t from-background from-70% via-background/90 via-80% to-transparent px-5 pt-7 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-md">
          {error ? (
            <p
              role="alert"
              className="mb-3 text-[14px] leading-[1.5] text-pretty text-host-danger"
            >
              {error}
            </p>
          ) : null}

          {note}

          <footer className="flex items-center gap-3">
            {/* The dots' job, as a shape rather than a count. */}
            <div
              aria-hidden="true"
              className="h-0.5 flex-1 overflow-hidden rounded-[2px] bg-white/10"
            >
              {/* The one element that crosses every step change unchanged, so
                  it grows on `advance` — a mechanical move. Scaled rather than
                  sized: transform, not layout. */}
              <motion.span
                className="block h-full origin-left bg-white/80"
                initial={false}
                animate={{ scaleX: (step + 1) / stepCount }}
                transition={reduceMotion ? still : T.advance}
              />
            </div>

            <motion.button
              type="button"
              disabled={blocked}
              aria-busy={ctaPending || undefined}
              whileTap={blocked || reduceMotion ? undefined : { scale: 0.97 }}
              transition={reduceMotion ? still : T.snap}
              onClick={() => {
                if (spent.current === step) return
                spent.current = step
                onNext?.()
              }}
              className={`${ctaTone === 'pay' ? HOST_PAY : HOST_PRIMARY} shrink-0 gap-2 disabled:pointer-events-none`}
            >
              {ctaPending ? (
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              ) : null}
              {cta}
              {ctaPending ? null : (
                <ArrowRight
                  className="size-[18px]"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              )}
            </motion.button>
          </footer>

          {footnote}
        </div>
      </div>
    </div>
  )
}
