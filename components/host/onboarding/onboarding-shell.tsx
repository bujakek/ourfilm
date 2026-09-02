'use client'

import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import { useEffect, useRef, type ReactNode } from 'react'
import { localeTag, type Locale } from '@/lib/i18n'
import { T } from '@/lib/motion'

export type OnboardingNav = {
  step: number
  stepCount: number
  backHref?: string
  onBack?: () => void
  onNext?: () => void
  error?: string | null
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
  const pad = (n: number) => String(n).padStart(2, '0')

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
            className="font-mono text-[11px] font-medium tracking-[0.14em] text-foreground/40"
          >
            {pad(step + 1)} / {pad(stepCount)}
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

        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={T.settle}
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
            <span
              className="block h-full bg-accent transition-[width] duration-300 ease-out"
              style={{ width: `${((step + 1) / stepCount) * 100}%` }}
            />
          </div>

          <motion.button
            type="button"
            disabled={blocked}
            whileTap={blocked ? undefined : { scale: 0.97 }}
            onClick={() => {
              if (spent.current === step) return
              spent.current = step
              onNext?.()
            }}
            className="paper btn-shine inline-flex min-h-14 shrink-0 items-center justify-center gap-2.5 rounded-xl px-6.5 text-[15px] font-semibold disabled:pointer-events-none disabled:opacity-50"
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
