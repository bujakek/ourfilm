'use client'

import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'

import type { StepScreen } from '@/components/host/onboarding/onboarding-shell'
import { HOST_KICKER_BASE, HOST_LINK } from '@/components/host/ui/classes'
import { DEFAULT_SHOTS } from '@/lib/camera'
import { FREE_PARTICIPANT_LIMIT, type EventPlan } from '@/lib/onboarding'
import { localePath, type Locale } from '@/lib/i18n'
import { T, still } from '@/lib/motion'

/**
 * Guest count is the last decision, and the only one on this screen. Roll
 * length and gallery access are no longer asked: they take the draft's
 * defaults (`DEFAULT_SHOTS`, visible) and live in settings, as do after-event
 * uploads, which onboarding does not offer at all.
 *
 * Both paths accept the Terms by pressing the button, under a line that says
 * so; the CTA that commits the draft sets `legalAccepted`. The paid path's
 * early-performance declaration is not asked here: the checkout screen asks
 * it beside the price, and `startEventCheckout` refuses without it, so a box
 * here only made the host tick the same thing twice.
 */
export function guestsScreen({
  plan,
  setPlan,
  paymentsEnabled,
  pending,
  locale,
  signedIn,
}: {
  plan: EventPlan
  setPlan: (value: EventPlan) => void
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
    eyebrow: en ? 'The guests' : 'A vendégek',
    title: en ? 'How many guests will you have?' : 'Hány vendéged lesz?',
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
    ctaPending: pending,
    // Sky is for payment, and a signed-out host is going to the save screen
    // first, not to Stripe.
    ctaTone: signedIn === true && plan === 'full' ? 'pay' : undefined,
    footnote: <TermsLine locale={locale} />,
    content: (
      <GuestsFields
        plan={plan}
        setPlan={setPlan}
        paymentsEnabled={paymentsEnabled}
        locale={locale}
      />
    ),
  }
}

function GuestsFields({
  plan,
  setPlan,
  paymentsEnabled,
  locale,
}: {
  plan: EventPlan
  setPlan: (value: EventPlan) => void
  paymentsEnabled: boolean
  locale: Locale
}) {
  const reduceMotion = useReducedMotion()
  const en = locale === 'en'

  return (
    <div className="flex flex-col">
      <fieldset>
        <legend className="sr-only">
          {en ? 'How many guests can join' : 'Hány vendég csatlakozhat'}
        </legend>
        {/* No price here: the billing country confirmed after saving decides
            which one applies, and the checkout screen names it. */}
        <div className="grid grid-cols-2 gap-2">
          <PlanTile
            value="free"
            plan={plan}
            setPlan={setPlan}
            figure={String(FREE_PARTICIPANT_LIMIT)}
            label={en ? 'Guests · free' : 'Vendégig · ingyenes'}
            detail={en ? 'One event, no fee.' : 'Egy esemény, nincs díj.'}
            reduceMotion={reduceMotion}
          />
          <PlanTile
            value="full"
            plan={plan}
            setPlan={setPlan}
            figure="∞"
            label={en ? 'Unlimited · paid' : 'Korlátlan · fizetős'}
            detail={
              paymentsEnabled
                ? en
                  ? 'One-time fee per event.'
                  : 'Egyszeri díj eseményenként.'
                : en
                  ? 'Coming soon'
                  : 'Hamarosan'
            }
            disabled={!paymentsEnabled}
            reduceMotion={reduceMotion}
          />
        </div>
      </fieldset>

      <p className="mx-1 mt-4 text-[14px] leading-[1.6] text-pretty text-white/65">
        {en
          ? `${DEFAULT_SHOTS} photos per guest. You can change this later in settings.`
          : `${DEFAULT_SHOTS} kép vendégenként. A galéria beállításait később a beállításokban módosíthatod.`}
      </p>
    </div>
  )
}

/** The onboarding's whole consent, on either plan: pressing the button is the
 *  acceptance, and this line under it says so. Each link is a 44px target, as the auth terms
 *  line's are: `py-3.5` on an inline box grows what a finger can hit without
 *  moving the line it sits on, which `min-h-11` on an inline-flex box would. */
function TermsLine({ locale }: { locale: Locale }) {
  return (
    <p className="mt-3.5 text-center text-[12px] leading-[1.6] text-pretty text-white/65">
      {locale === 'en' ? (
        <>
          By creating the event you accept the{' '}
          <Link
            href={localePath(locale, '/aszf')}
            target="_blank"
            rel="noopener noreferrer"
            className={`py-3.5 ${HOST_LINK}`}
          >
            Terms
          </Link>{' '}
          and the{' '}
          <Link
            href={localePath(locale, '/adatvedelem')}
            target="_blank"
            rel="noopener noreferrer"
            className={`py-3.5 ${HOST_LINK}`}
          >
            Privacy Notice
          </Link>
          .
        </>
      ) : (
        <>
          A létrehozással elfogadod az{' '}
          <Link
            href={localePath(locale, '/aszf')}
            target="_blank"
            rel="noopener noreferrer"
            className={`py-3.5 ${HOST_LINK}`}
          >
            ÁSZF
          </Link>
          -et és az{' '}
          <Link
            href={localePath(locale, '/adatvedelem')}
            target="_blank"
            rel="noopener noreferrer"
            className={`py-3.5 ${HOST_LINK}`}
          >
            adatkezelési tájékoztatót
          </Link>
          .
        </>
      )}
    </p>
  )
}

/**
 * One tier: a figure, a kicker and a sentence.
 *
 * Selection is a sky ring and a sky wash, and the figure and kicker turn sky
 * with it — selected state is one of the two things sky may mean. The ring
 * travels between the tiles on `snap`, a transform, rather than being redrawn.
 */
function PlanTile({
  value,
  plan,
  setPlan,
  figure,
  label,
  detail,
  disabled = false,
  reduceMotion,
}: {
  value: EventPlan
  plan: EventPlan
  setPlan: (value: EventPlan) => void
  figure: string
  label: string
  detail: string
  disabled?: boolean
  reduceMotion: boolean | null
}) {
  const active = plan === value
  const ink = active ? 'text-landing-sky' : 'text-white'
  return (
    <label
      className={`relative flex min-h-[150px] flex-col justify-between gap-4 rounded-[24px] bg-host-panel px-[18px] py-5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-white/60 ${
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
      }`}
    >
      {active ? (
        <motion.span
          layoutId="plan-selection"
          aria-hidden="true"
          className="absolute inset-0 rounded-[24px] bg-landing-sky/10 ring-[1.5px] ring-landing-sky ring-inset"
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
      <span
        aria-hidden="true"
        className={`host-figure relative text-[56px] leading-none ${ink}`}
      >
        {figure}
      </span>
      <span className="relative">
        <span className={`${HOST_KICKER_BASE} block ${ink}`}>
          {value === 'free' ? <span className="sr-only">{figure} </span> : null}
          {label}
        </span>
        <span className="mt-1 block text-[14px] leading-[1.5] text-pretty text-white/65">
          {detail}
        </span>
      </span>
    </label>
  )
}
