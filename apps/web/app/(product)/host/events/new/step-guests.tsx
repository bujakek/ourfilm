'use client'

import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import {
  LegalDetails,
  PaidTermsAcceptance,
} from '@/components/host/paid-terms-acceptance'
import type { StepScreen } from '@/components/host/onboarding/onboarding-shell'
import { DEFAULT_SHOTS } from '@/lib/camera'
import { FREE_PARTICIPANT_LIMIT, type EventPlan } from '@/lib/onboarding'
import { eventPriceLabel } from '@/lib/pricing'
import { localePath, type Locale } from '@/lib/i18n'
import { T, still } from '@/lib/motion'

/**
 * Guest count is the last decision, and the only one on this screen. Roll
 * length and gallery access are no longer asked: they take the draft's
 * defaults (`DEFAULT_SHOTS`, visible) and live in settings, as do after-event
 * uploads, which onboarding does not offer at all.
 *
 * The free path accepts the Terms by pressing the button, under a line that
 * says so; the CTA that commits the draft sets `legalAccepted`. The paid path
 * keeps its explicit declaration, ticked before the button wakes.
 */
export function guestsScreen({
  plan,
  setPlan,
  legalAccepted,
  setLegalAccepted,
  paymentsEnabled,
  pending,
  locale,
  signedIn,
}: {
  plan: EventPlan
  setPlan: (value: EventPlan) => void
  legalAccepted: boolean
  setLegalAccepted: (value: boolean) => void
  /** Whether Stripe is switched on in this environment. When it is not, the
   *  paid tier is not offered — a price on a button that cannot charge is a
   *  worse answer than not showing the button. */
  paymentsEnabled: boolean
  pending: boolean
  locale: Locale
  signedIn: boolean | null
}): StepScreen {
  const en = locale === 'en'

  return {
    compact: true,
    eyebrow: en ? 'THE GUESTS' : 'A VENDÉGEK',
    title: en
      ? 'How many guests are you expecting?'
      : 'Hány vendégre számítasz?',
    cta:
      signedIn !== true
        ? en
          ? 'Continue to save'
          : 'Tovább a mentéshez'
        : plan === 'full'
          ? en
            ? 'Continue to payment'
            : 'Tovább a fizetéshez'
          : en
            ? 'Create event'
            : 'Létrehozás',
    ctaDisabled: plan === 'full' && !legalAccepted,
    ctaPending: pending,
    ctaTone: plan === 'full' ? 'pay' : undefined,
    footnote: plan === 'full' ? undefined : <FreeTermsLine locale={locale} />,
    content: (
      <GuestsFields
        plan={plan}
        setPlan={setPlan}
        legalAccepted={legalAccepted}
        setLegalAccepted={setLegalAccepted}
        paymentsEnabled={paymentsEnabled}
        locale={locale}
      />
    ),
  }
}

function GuestsFields({
  plan,
  setPlan,
  legalAccepted,
  setLegalAccepted,
  paymentsEnabled,
  locale,
}: {
  plan: EventPlan
  setPlan: (value: EventPlan) => void
  legalAccepted: boolean
  setLegalAccepted: (value: boolean) => void
  paymentsEnabled: boolean
  locale: Locale
}) {
  const reduceMotion = useReducedMotion()
  const en = locale === 'en'

  return (
    <div className="flex flex-col gap-4.5">
      <fieldset>
        <legend className="sr-only">
          {en ? 'How many guests can join' : 'Hány vendég csatlakozhat'}
        </legend>
        {/* The exact checkout price follows the country confirmed after saving. */}
        <div className="grid grid-cols-2 gap-2.5">
          <PlanTile
            value="free"
            plan={plan}
            setPlan={setPlan}
            figure={en ? 'Free event' : 'Ingyenes esemény'}
            label={`${FREE_PARTICIPANT_LIMIT} ${en ? 'guests' : 'vendég'}`}
            price={en ? '0 USD' : '0 Ft'}
            reduceMotion={reduceMotion}
          />
          <PlanTile
            value="full"
            plan={plan}
            setPlan={setPlan}
            figure={en ? 'Unlimited event' : 'Korlátlan esemény'}
            label={en ? 'Unlimited guests' : 'Korlátlan vendég'}
            price={
              paymentsEnabled
                ? eventPriceLabel(locale).replace(/ /g, '\u00a0')
                : en
                  ? 'Coming soon'
                  : 'Hamarosan'
            }
            offer={
              paymentsEnabled ? (
                <>
                  <span className="block text-xs text-muted-foreground">
                    {en ? 'one-time payment' : 'egyszeri díj'}
                  </span>
                  <span className="mt-2 block text-xs leading-relaxed text-muted-foreground">
                    {en
                      ? 'No app • no subscription'
                      : 'Nincs app • nincs előfizetés'}
                  </span>
                </>
              ) : null
            }
            disabled={!paymentsEnabled}
            reduceMotion={reduceMotion}
          />
        </div>
      </fieldset>

      <p className="text-[13px] leading-[1.6] text-pretty text-muted-foreground">
        {en
          ? `${DEFAULT_SHOTS} photos per guest. You can change the gallery settings later in settings.`
          : `${DEFAULT_SHOTS} kép vendégenként. A galéria beállításait később a beállításokban módosíthatod.`}
      </p>

      {plan === 'full' ? (
        <div className="border-t border-border pt-4.5">
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[13px] leading-[1.6] text-foreground/80">
            <input
              type="checkbox"
              checked={legalAccepted}
              onChange={(event) => setLegalAccepted(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
            />
            <PaidTermsAcceptance locale={locale} />
          </label>
          <div className="ml-7">
            <LegalDetails locale={locale} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** The free path's whole consent: pressing the button is the acceptance, and
 *  this line under it says so. */
function FreeTermsLine({ locale }: { locale: Locale }) {
  const link = 'underline underline-offset-2 hover:text-foreground'
  return locale === 'en' ? (
    <p className="mt-3.5 text-center text-[12px] leading-[1.6] text-muted-foreground">
      By creating the event you accept the{' '}
      <Link href={localePath(locale, '/aszf')} target="_blank" className={link}>
        Terms
      </Link>{' '}
      and the{' '}
      <Link
        href={localePath(locale, '/adatvedelem')}
        target="_blank"
        className={link}
      >
        Privacy Notice
      </Link>
      .
    </p>
  ) : (
    <p className="mt-3.5 text-center text-[12px] leading-[1.6] text-muted-foreground">
      A létrehozással elfogadod az{' '}
      <Link href={localePath(locale, '/aszf')} target="_blank" className={link}>
        ÁSZF
      </Link>
      -et és az{' '}
      <Link
        href={localePath(locale, '/adatvedelem')}
        target="_blank"
        className={link}
      >
        adatkezelési tájékoztatót
      </Link>
      .
    </p>
  )
}

/**
 * One tier, with a compact offer for the paid option.
 *
 * Selection is a 1.5px lilac border and a faint lilac wash rather than a tick:
 * the border is the thing the eye already uses to tell the two cards apart, so
 * thickening and colouring it is the cheapest possible signal — and the tick
 * was competing with the numeral for the same corner.
 */
function PlanTile({
  value,
  plan,
  setPlan,
  figure,
  label,
  price,
  offer,
  disabled = false,
  reduceMotion,
}: {
  value: EventPlan
  plan: EventPlan
  setPlan: (value: EventPlan) => void
  figure: string
  label: string
  price: string
  offer?: ReactNode
  disabled?: boolean
  reduceMotion: boolean | null
}) {
  const active = plan === value
  return (
    <label
      className={`relative flex flex-col rounded-lg px-4 py-3.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
        active
          ? 'border border-transparent text-accent'
          : 'border border-white/13'
      } ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
    >
      {active ? (
        <motion.span
          layoutId="plan-selection"
          aria-hidden="true"
          className="absolute -inset-px rounded-lg border-[1.5px] border-accent bg-accent/9"
          transition={reduceMotion ? still : T.snap}
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
      <span className="relative z-10 min-h-[2.75em] text-[15px] leading-snug font-semibold">
        {figure}
      </span>
      <span
        className={`relative z-10 mt-2 text-xs leading-relaxed ${
          active ? 'text-accent' : 'text-muted-foreground'
        }`}
      >
        {label}
      </span>
      <span
        className={`relative z-10 mt-3 font-semibold tabular-nums ${disabled ? 'text-sm' : 'text-lg min-[375px]:text-xl'}`}
      >
        {price}
      </span>
      {offer ? <span className="relative z-10 mt-0.5">{offer}</span> : null}
    </label>
  )
}
