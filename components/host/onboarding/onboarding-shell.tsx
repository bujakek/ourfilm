'use client'

import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
  compact?: boolean
  note?: ReactNode
  content: ReactNode
}

/**
 * One question per screen, set like an editorial page rather than a survey.
 *
 * Three things carry that, and each replaced something that was doing the job
 * badly:
 *
 * - **An eyebrow naming the thing being decided**, then the question in the
 *   display serif, **left aligned**. A centred 28px heading over a left-aligned
 *   form is most of what made these screens read as a form to get through
 *   rather than a thing being made.
 * - **A step counter and a rule instead of dots.** `01 / 04` says where you are
 *   without anyone counting circles, and the rule along the bottom is the same
 *   information as a shape. The dots' accessible equivalent survives verbatim
 *   below — a visually hidden ordered list carrying `aria-current` — because
 *   the counter is the thing a sighted host reads, not the thing a screen
 *   reader should be handed.
 * - **One material per screen.** The back button and the CTA are the only
 *   chrome, and the CTA is `.paper`: on a flow whose whole subject is a
 *   printed ticket, the button that advances it is the printed thing.
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
  onNext,
  error = null,
  note = null,
  compact = false,
  children,
  locale = 'hu',
}: {
  /** Names the thing being decided, in mono caps. The one lilac on the screen. */
  eyebrow: string
  title: string
  /** Optional: the last screen carries three controls and drops it for room. */
  detail?: string
  step: number
  stepCount: number
  backHref?: string
  onBack?: () => void
  cta: string
  ctaDisabled?: boolean
  ctaPending?: boolean
  onNext?: () => void
  error?: string | null
  note?: ReactNode
  /** Sets the question at 34px instead of 40px. See `detail` above. */
  compact?: boolean
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
      className="flex h-[100dvh] flex-col overflow-hidden px-6 pt-[calc(1.375rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
      // Every step of the create flow renders through this shell, so marking
      // the language here covers the whole flow. See `app/(product)/layout.tsx`.
      lang={localeTag[locale]}
    >
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col">
        <header className="flex items-center justify-between">
          {backHref ? (
            <Link
              href={backHref}
              aria-label={en ? 'Back to events' : 'Vissza az eseményekhez'}
              className={backButtonClassName}
            >
              <ArrowLeft className="size-[19px]" aria-hidden="true" />
            </Link>
          ) : (
            <motion.button
              type="button"
              onClick={onBack}
              whileTap={{ scale: 0.94 }}
              aria-label={
                en
                  ? 'Back to the previous question'
                  : 'Vissza az előző kérdéshez'
              }
              className={backButtonClassName}
            >
              <ArrowLeft className="size-[19px]" aria-hidden="true" />
            </motion.button>
          )}

          {/* The counter is what a host reads; the list under it is what a
              screen reader gets. Announcing "zero one slash zero four" would be
              a worse answer than the sentence the list already carried. */}
          <p
            aria-hidden="true"
            className="flex items-center font-mono text-[11px] font-medium tracking-[0.14em] text-foreground/40"
          >
            <Odometer value={step + 1} dir={dir > 0 ? 'up' : 'down'} pad={2} />
            <span className="px-1">/</span>
            {String(stepCount).padStart(2, '0')}
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
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className={compact ? 'mt-5' : 'mt-7'}>
              <p className="font-mono text-[9.5px] font-medium tracking-[0.2em] text-accent">
                {eyebrow}
              </p>
              <h1
                className={`font-display tracking-[-0.01em] text-balance ${
                  compact
                    ? 'mt-3.5 text-[34px] leading-[1.06]'
                    : 'mt-4 text-[40px] leading-[1.06]'
                }`}
              >
                {title}
              </h1>
              {detail ? (
                <p className="mt-3.5 max-w-[20rem] text-[14.5px] leading-[1.6] text-pretty text-muted-foreground">
                  {detail}
                </p>
              ) : null}
            </div>

            <div
              className={`-mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto px-1 ${
                compact ? 'mt-5' : 'mt-9'
              }`}
            >
              {children}
            </div>
          </motion.div>
        </AnimatePresence>

        {error ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {note}

        <footer className="mt-5 flex items-center gap-3.5 pt-1">
          {/* The dots' job, as a shape rather than a count. `aria-hidden`
              because the visually hidden step list above is the announcement
              and two of them would be one too many. */}
          <div
            aria-hidden="true"
            className="h-0.5 flex-1 overflow-hidden rounded-[2px] bg-white/10"
          >
            {/* The one element that crosses every step change unchanged, which
                is what makes four screens read as one sheet. So it grows on
                `advance` — a mechanical move — and is never cut and redrawn. */}
            <motion.span
              className="block h-full bg-accent"
              initial={false}
              animate={{ width: `${((step + 1) / stepCount) * 100}%` }}
              transition={reduceMotion ? still : T.advance}
            />
          </div>

          {/* Submitted: the button holds at half strength rather than
              flickering between states. The dim is an `animate` value, not
              `disabled:opacity-50`, because motion writes an inline opacity
              and the two would otherwise fight over the same property. */}
          <motion.button
            type="button"
            disabled={blocked}
            initial={false}
            animate={{ opacity: blocked ? 0.5 : 1 }}
            whileTap={blocked || reduceMotion ? undefined : { scale: 0.97 }}
            transition={reduceMotion ? still : { ...T.snap, opacity: T.settle }}
            onClick={() => {
              if (spent.current === step) return
              spent.current = step
              onNext?.()
            }}
            className="paper btn-shine inline-flex min-h-14 shrink-0 items-center justify-center gap-2.5 rounded-xl px-6.5 text-[15px] font-semibold disabled:pointer-events-none"
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
      </div>
    </div>
  )
}

/** A bordered outline, not `.glass` — the back arrow is the most inert control
 *  in the flow and was wearing the same material as the thing being decided. */
const backButtonClassName =
  'flex size-11 shrink-0 items-center justify-center rounded-lg border border-white/15 text-foreground transition-colors hover:border-white/30'
