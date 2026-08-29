'use client'

import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import { useEffect, useRef, type ReactNode } from 'react'
import type { Locale } from '@/lib/i18n'

export type OnboardingNav = {
  step: number
  stepCount: number
  backHref?: string
  onBack?: () => void
  onNext?: () => void
  error?: string | null
}

export function OnboardingShell({
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
  children,
  locale = 'hu',
}: {
  title: string
  detail: string
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
  children: ReactNode
  locale?: Locale
}) {
  const spent = useRef<number | null>(null)
  useEffect(() => {
    spent.current = null
  }, [step, ctaPending])

  const blocked = ctaDisabled || ctaPending

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col">
        <header>
          {backHref ? (
            <Link
              href={backHref}
              aria-label={
                locale === 'en' ? 'Back to events' : 'Vissza az eseményekhez'
              }
              className="glass flex size-12 items-center justify-center rounded-[0.875rem]"
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
            </Link>
          ) : (
            <motion.button
              type="button"
              onClick={onBack}
              whileTap={{ scale: 0.94 }}
              aria-label={
                locale === 'en'
                  ? 'Back to the previous question'
                  : 'Vissza az előző kérdéshez'
              }
              className="glass flex size-12 items-center justify-center rounded-[0.875rem]"
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
            </motion.button>
          )}
        </header>

        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="mt-6 text-center">
              <h1 className="font-display text-[1.75rem] leading-[1.15] font-semibold tracking-tight text-balance">
                {title}
              </h1>
              <p className="mx-auto mt-3 max-w-[19rem] text-sm leading-relaxed text-pretty text-muted-foreground">
                {detail}
              </p>
            </div>

            <div className="-mx-1 mt-8 flex min-h-0 flex-1 flex-col overflow-y-auto px-1">
              {children}
            </div>
          </motion.div>
        </AnimatePresence>

        {error ? (
          <p role="alert" className="mt-4 text-center text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {note}

        <footer className="mt-6 grid min-h-14 grid-cols-[1fr_auto] items-center gap-3">
          <ol
            aria-label={locale === 'en' ? 'Steps' : 'Lépések'}
            className="pointer-events-none flex justify-center gap-2"
          >
            {Array.from({ length: stepCount }, (_, i) => (
              <motion.li
                key={i}
                aria-current={i === step ? 'step' : undefined}
                animate={{
                  scale: i === step ? 1.35 : 1,
                  opacity: i === step ? 1 : 0.3,
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                className={`size-2 rounded-full ${
                  i === step ? 'bg-foreground' : 'bg-muted-foreground'
                }`}
              >
                <span className="sr-only">
                  {locale === 'en'
                    ? `Step ${i + 1}${i === step ? ' — current' : ''}`
                    : `${i + 1}. lépés${i === step ? ' — jelenlegi' : ''}`}
                </span>
              </motion.li>
            ))}
          </ol>

          <motion.button
            type="button"
            disabled={blocked}
            whileTap={blocked ? undefined : { scale: 0.97 }}
            onClick={() => {
              if (spent.current === step) return
              spent.current = step
              onNext?.()
            }}
            className="btn-shine inline-flex min-h-14 items-center gap-2 rounded-[1.25rem] bg-primary px-6 text-base font-semibold text-primary-foreground transition-opacity disabled:opacity-30"
          >
            {ctaPending ? (
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            ) : null}
            {cta}
            {ctaPending ? null : (
              <ArrowRight
                className="size-5"
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
