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
import type { Locale } from '@/lib/i18n'

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
  locale,
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
  locale: Locale
}) {
  const reduceMotion = useReducedMotion()
  const en = locale === 'en'

  return (
    <OnboardingShell
      {...nav}
      locale={locale}
      title={en ? 'How many guests are coming?' : 'Hány vendéged lesz?'}
      detail={
        en
          ? 'Give everyone a chance to capture part of the day.'
          : 'Mindenki kapjon esélyt, hogy elkapja a pillanatot.'
      }
      cta={
        plan === 'full'
          ? en
            ? 'Continue to payment'
            : 'Tovább a fizetéshez'
          : en
            ? 'Create event'
            : 'Létrehozás'
      }
      ctaDisabled={!legalAccepted}
      ctaPending={pending}
      note={<AccountNotice locale={locale} />}
    >
      <div className="flex flex-col gap-6">
        <fieldset>
          <SectionLabel>{en ? 'GUESTS' : 'VENDÉGEK'}</SectionLabel>
          <legend className="sr-only">
            {en ? 'How many guests can join' : 'Hány vendég csatlakozhat'}
          </legend>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <PlanTile
              value="free"
              plan={plan}
              setPlan={setPlan}
              title={
                en
                  ? `Up to ${FREE_PARTICIPANT_LIMIT}`
                  : `Legfeljebb ${FREE_PARTICIPANT_LIMIT}`
              }
              detail={en ? 'Free' : 'Ingyenes'}
              reduceMotion={reduceMotion}
            />
            <PlanTile
              value="full"
              plan={plan}
              setPlan={setPlan}
              title={en ? 'Unlimited' : 'Korlátlan'}
              detail={
                paymentsEnabled
                  ? en
                    ? 'HUF 12,900'
                    : EVENT_PRICE_LABEL
                  : en
                    ? 'Coming soon'
                    : 'Hamarosan'
              }
              disabled={!paymentsEnabled}
              reduceMotion={reduceMotion}
            />
          </div>
        </fieldset>

        <fieldset className="border-t border-border pt-5">
          <SectionLabel>
            {en ? 'SHOTS PER GUEST' : 'KÉPEK VENDÉGENKÉNT'}
          </SectionLabel>
          <legend className="sr-only">
            {en ? 'Shots per guest' : 'Képek száma vendégenként'}
          </legend>
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
                      className="absolute inset-0 rounded-[1.1rem] bg-accent/10 ring-2 ring-accent ring-inset"
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
                    <span className="sr-only">
                      {' '}
                      — {en ? 'recommended' : 'ajánlott'}
                    </span>
                  ) : null}
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="border-t border-border pt-5">
          <SectionLabel>{en ? 'GALLERY ACCESS' : 'LÁTHATÓSÁG'}</SectionLabel>
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
                  ? en
                    ? 'Guests can see the full gallery.'
                    : 'A vendégek is látják az összes képet.'
                  : en
                    ? 'Only you can see the photos.'
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
                {en ? 'I accept the ' : 'Elfogadom az '}
                <Link
                  href={en ? '/en/terms' : '/hu/aszf'}
                  target="_blank"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {en ? 'Terms' : 'ÁSZF-et'}
                </Link>
                {en
                  ? ', and expressly ask OurFilm to start the service before the 14-day cancellation period ends. I understand that, if I cancel after service has started, I may have to pay for the proportion already supplied.'
                  : ', és kifejezetten kérem, hogy az OurFilm a 14 napos elállási/felmondási időszak vége előtt kezdje meg a szolgáltatást. Tudomásul veszem, hogy felmondás esetén a megszűnésig arányosan teljesített szolgáltatás díját meg kell fizetnem.'}
              </>
            ) : (
              <>
                {en ? 'I accept the ' : 'Elfogadom az '}
                <Link
                  href={en ? '/en/terms' : '/hu/aszf'}
                  target="_blank"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {en ? 'Terms' : 'ÁSZF-et'}
                </Link>
                .
              </>
            )}{' '}
            {en ? 'The ' : 'Az '}
            <Link
              href={en ? '/en/privacy' : '/hu/adatvedelem'}
              target="_blank"
              className="underline underline-offset-2 hover:text-foreground"
            >
              {en ? 'Privacy Notice' : 'adatkezelési tájékoztató'}
            </Link>{' '}
            {en
              ? 'explains how personal data is handled.'
              : 'ismerteti az adatok kezelését.'}
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
          className="absolute inset-0 rounded-[1.25rem] bg-accent/10 ring-2 ring-accent ring-inset"
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
