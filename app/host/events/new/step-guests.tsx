'use client'

import { Check } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'

import { AccountNotice } from '@/components/host/onboarding/account-notice'
import {
  OnboardingShell,
  type OnboardingNav,
} from '@/components/host/onboarding/onboarding-shell'
import { DEFAULT_SHOTS, SHOT_OPTIONS, type ShotOption } from '@/lib/camera'
import { FREE_PARTICIPANT_LIMIT, type EventPlan } from '@/lib/onboarding'
import { EVENT_PRICE_LABEL } from '@/lib/pricing'

export function StepGuests({
  nav,
  plan,
  setPlan,
  shots,
  setShots,
  guestsCanView,
  setGuestsCanView,
  legalAccepted,
  setLegalAccepted,
  paymentsEnabled,
  pending,
}: {
  nav: OnboardingNav
  plan: EventPlan
  setPlan: (value: EventPlan) => void
  shots: ShotOption
  setShots: (value: ShotOption) => void
  guestsCanView: boolean
  setGuestsCanView: (value: boolean) => void
  legalAccepted: boolean
  setLegalAccepted: (value: boolean) => void
  /** Whether Stripe is switched on in this environment. When it is not, the
   *  paid tier is not offered — a price on a button that cannot charge is a
   *  worse answer than not showing the button. */
  paymentsEnabled: boolean
  pending: boolean
}) {
  const reduceMotion = useReducedMotion()

  return (
    <OnboardingShell
      {...nav}
      title="Hány vendéged lesz?"
      detail="Mindenki kapjon esélyt, hogy elkapja a pillanatot."
      cta={plan === 'full' ? 'Tovább a fizetéshez' : 'Létrehozás'}
      ctaDisabled={!legalAccepted}
      ctaPending={pending}
      note={<AccountNotice />}
    >
      <div className="flex flex-col gap-6">
        <fieldset>
          <SectionLabel>VENDÉGEK</SectionLabel>
          <legend className="sr-only">Hány vendég csatlakozhat</legend>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <PlanTile
              value="free"
              plan={plan}
              setPlan={setPlan}
              title={`Legfeljebb ${FREE_PARTICIPANT_LIMIT}`}
              detail="Ingyenes"
              reduceMotion={reduceMotion}
            />
            <PlanTile
              value="full"
              plan={plan}
              setPlan={setPlan}
              title="Korlátlan"
              detail={paymentsEnabled ? EVENT_PRICE_LABEL : 'Hamarosan'}
              disabled={!paymentsEnabled}
              reduceMotion={reduceMotion}
            />
          </div>
        </fieldset>

        <fieldset className="border-t border-border pt-5">
          <SectionLabel>KÉPEK VENDÉGENKÉNT</SectionLabel>
          <legend className="sr-only">Képek száma vendégenként</legend>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {SHOT_OPTIONS.map((option) => {
              const active = option === shots
              return (
                <label
                  key={option}
                  className={`glass relative flex min-h-16 cursor-pointer items-center justify-center overflow-hidden rounded-[1.1rem] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                    active
                      ? 'text-lg font-bold text-accent'
                      : 'text-base font-medium'
                  }`}
                >
                  {active ? (
                    <motion.span
                      layoutId="shots-selection"
                      aria-hidden="true"
                      className="absolute inset-0 rounded-[1.1rem] bg-accent/10 ring-2 ring-inset ring-accent"
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { type: 'spring', stiffness: 520, damping: 38 }
                      }
                    />
                  ) : null}
                  <input
                    type="radio"
                    name="shots_choice"
                    value={option}
                    checked={active}
                    onChange={() => setShots(option)}
                    className="sr-only"
                  />
                  <motion.span
                    className="relative z-10"
                    animate={{ scale: active ? 1.06 : 1 }}
                    transition={{ duration: reduceMotion ? 0 : 0.16 }}
                  >
                    {option}
                  </motion.span>
                  {option === DEFAULT_SHOTS ? (
                    <span className="sr-only"> — ajánlott</span>
                  ) : null}
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="border-t border-border pt-5">
          <SectionLabel>LÁTHATÓSÁG</SectionLabel>
          <button
            type="button"
            role="switch"
            aria-checked={guestsCanView}
            onClick={() => setGuestsCanView(!guestsCanView)}
            className="mt-3 flex w-full items-center gap-3 text-left"
          >
            <motion.span
              aria-hidden="true"
              animate={{
                backgroundColor: guestsCanView
                  ? 'var(--color-accent)'
                  : 'color-mix(in oklab, var(--color-muted-foreground) 30%, transparent)',
              }}
              transition={{ duration: reduceMotion ? 0 : 0.18 }}
              className="relative h-7 w-12 shrink-0 rounded-full"
            >
              <motion.span
                className="absolute top-1 left-1 size-5 rounded-full bg-white"
                animate={{ x: guestsCanView ? 20 : 0 }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 600, damping: 38 }
                }
              />
            </motion.span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={guestsCanView ? 'visible' : 'private'}
                initial={reduceMotion ? false : { opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -3 }}
                transition={{ duration: reduceMotion ? 0 : 0.14 }}
                className="text-sm leading-snug text-pretty"
              >
                {guestsCanView
                  ? 'A vendégek is látják az összes képet.'
                  : 'Csak te látod a képeket.'}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>

        <label className="flex cursor-pointer items-start gap-3 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
          <input
            type="checkbox"
            checked={legalAccepted}
            onChange={(event) => setLegalAccepted(event.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
          />
          <span>
            {plan === 'full' ? (
              <>
                Elfogadom az{' '}
                <Link
                  href="/hu/aszf"
                  target="_blank"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  ÁSZF-et
                </Link>
                , és kérem, hogy a szolgáltatás a 14 napos elállási határidő
                lejárta előtt megkezdődjön. Tudomásul veszem az ÁSZF-ben leírt
                elállási következményeket.
              </>
            ) : (
              <>
                Elfogadom az{' '}
                <Link
                  href="/hu/aszf"
                  target="_blank"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  ÁSZF-et
                </Link>
                .
              </>
            )}{' '}
            Az{' '}
            <Link
              href="/hu/adatvedelem"
              target="_blank"
              className="underline underline-offset-2 hover:text-foreground"
            >
              adatkezelési tájékoztató
            </Link>{' '}
            ismerteti az adatok kezelését.
          </span>
        </label>
      </div>
    </OnboardingShell>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-xs tracking-[0.2em] text-muted-foreground/70">
      {children}
    </p>
  )
}

function PlanTile({
  value,
  plan,
  setPlan,
  title,
  detail,
  disabled = false,
  reduceMotion,
}: {
  value: EventPlan
  plan: EventPlan
  setPlan: (value: EventPlan) => void
  title: string
  detail: string
  disabled?: boolean
  reduceMotion: boolean | null
}) {
  const active = plan === value
  return (
    <label
      className={`glass relative flex min-h-20 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-[1.25rem] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
      } ${active ? 'text-accent' : ''}`}
    >
      {active ? (
        <motion.span
          layoutId="plan-selection"
          aria-hidden="true"
          className="absolute inset-0 rounded-[1.25rem] bg-accent/10 ring-2 ring-inset ring-accent"
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 480, damping: 38 }
          }
        />
      ) : null}
      <input
        type="radio"
        name="plan_choice"
        value={value}
        checked={active}
        disabled={disabled}
        onChange={() => setPlan(value)}
        className="sr-only"
      />
      <span className="relative z-10 flex items-center gap-1.5 text-base font-semibold">
        <AnimatePresence initial={false}>
          {active ? (
            <motion.span
              initial={reduceMotion ? false : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.6 }}
              transition={{ duration: reduceMotion ? 0 : 0.14 }}
            >
              <Check className="size-4" strokeWidth={2.4} aria-hidden="true" />
            </motion.span>
          ) : null}
        </AnimatePresence>
        {title}
      </span>
      <span
        className={`relative z-10 text-xs ${
          active ? 'text-accent/80' : 'text-muted-foreground'
        }`}
      >
        {detail}
      </span>
    </label>
  )
}
