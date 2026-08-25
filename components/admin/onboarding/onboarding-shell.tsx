'use client'

import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Where a step sits in the flow and what the two navigation controls do.
 *
 * Bundled rather than spread across four call sites because every step passes
 * the same six values through unchanged, and the number of steps is the one
 * thing all of them have to agree on.
 */
export type OnboardingNav = {
  step: number
  stepCount: number
  /** Set on the first step only — there is no previous question to go back to,
   *  so the arrow leaves the flow entirely. */
  backHref?: string
  onBack?: () => void
  onNext?: () => void
  error?: string | null
}

/**
 * The frame every onboarding question is asked inside.
 *
 * One question per screen, and the screen is the whole phone: a back arrow in
 * the top-left corner, a centred heading, the answer in the middle, and a row
 * at the bottom holding the progress dots and the only button. There is no
 * header, no step counter, no breadcrumb and no second navigation control —
 * everything that is not the question is either the way back or the way on.
 *
 * The box is exactly `100dvh` and the question inside it scrolls, rather than
 * the other way round. On the 390x844 this is designed against nothing scrolls
 * at all; on anything shorter — an SE, a landscape phone — it is the calendar
 * that gives, and the back arrow, the dots and the CTA stay exactly where they
 * were. A `min-h` box would have grown instead and taken the CTA off the bottom
 * of the screen, which is the one control that must never move.
 *
 * `dvh`, not `vh`: it tracks the browser's own retracting chrome. It does not
 * track the software keyboard, and nothing does — the name screen answers that
 * with a keyboard "next" key that advances the step (see `step-name.tsx`), and
 * dismissing the keyboard brings the CTA back either way.
 *
 * The safe-area insets are added to the padding rather than substituted for it,
 * so a notchless Android still gets a real margin.
 */
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
  submit = false,
  error = null,
  children,
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
  submit?: boolean
  error?: string | null
  children: ReactNode
}) {
  // A tap on the CTA advances a step, and a step is one render away. Two taps
  // inside that frame would advance two, skipping a question the host never
  // answered — so the click is spent, and only a new `step` re-arms it.
  const spent = useRef<number | null>(null)
  useEffect(() => {
    spent.current = null
  }, [step])

  const blocked = ctaDisabled || ctaPending

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]">
      {/* min-h-0 here as well as on the scroller below. A flex item's
          min-height defaults to its content, so without it this column grows
          past the 100dvh box and the overflow-hidden above simply clips the
          time row and the CTA off the bottom — no scrollbar, no symptom, just
          missing controls on a short screen. */}
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col">
        <header>
          {backHref ? (
            <Link
              href={backHref}
              aria-label="Vissza az eseményekhez"
              className="glass flex size-12 items-center justify-center rounded-[0.875rem]"
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={onBack}
              aria-label="Vissza az előző kérdéshez"
              className="glass flex size-12 items-center justify-center rounded-[0.875rem]"
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
            </button>
          )}
        </header>

        <div className="mt-6 text-center">
          {/* Manrope is the only family in the project and `--font-display`
              already points at it, so the display treatment here is weight and
              scale rather than a second webfont downloaded for four screens. */}
          <h1 className="font-display text-[1.75rem] leading-[1.15] font-semibold tracking-tight text-balance">
            {title}
          </h1>
          <p className="mx-auto mt-3 max-w-[19rem] text-sm leading-relaxed text-pretty text-muted-foreground">
            {detail}
          </p>
        </div>

        {/* min-h-0 is what lets a child measure itself against the space that
            is actually left — without it a flex item's height floors at its
            content, and the reveal preview would push the option cards off the
            bottom of a 390x844 screen instead of shrinking.

            `overflow-y-auto` is the fallback for everything shorter than the
            390x844 this is designed against. The four screens fit there with
            room to spare, but a full month grid does not fit an iPhone SE — and
            the wrong way to lose that fight is the page scrolling, which takes
            the CTA and the progress dots off the bottom of the screen with it.
            This way the question scrolls and the way forward never moves.

            The negative margin gives focus rings somewhere to draw: a scroll
            container clips them flush against its edge otherwise. */}
        <div className="-mx-1 mt-8 flex min-h-0 flex-1 flex-col overflow-y-auto px-1">
          {children}
        </div>

        {error ? (
          <p role="alert" className="mt-4 text-center text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <footer className="relative mt-6 flex min-h-14 items-center justify-end">
          <ol
            aria-label="Lépések"
            className="pointer-events-none absolute inset-x-0 flex justify-center gap-2"
          >
            {Array.from({ length: stepCount }, (_, i) => (
              <li
                key={i}
                aria-current={i === step ? 'step' : undefined}
                className={`size-2 rounded-full ${
                  i === step ? 'bg-foreground' : 'bg-muted-foreground/30'
                }`}
              >
                <span className="sr-only">
                  {i + 1}. lépés{i === step ? ' — jelenlegi' : ''}
                </span>
              </li>
            ))}
          </ol>

          <button
            type={submit ? 'submit' : 'button'}
            disabled={blocked}
            onClick={
              submit
                ? undefined
                : () => {
                    if (spent.current === step) return
                    spent.current = step
                    onNext?.()
                  }
            }
            className="btn-shine relative inline-flex min-h-14 items-center gap-2 rounded-[1.25rem] bg-primary px-6 text-base font-semibold text-primary-foreground transition-opacity disabled:opacity-30"
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
          </button>
        </footer>
      </div>
    </div>
  )
}
