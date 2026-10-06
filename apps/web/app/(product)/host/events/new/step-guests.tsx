'use client'

import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'

import { AccountNotice } from '@/components/host/onboarding/account-notice'
import { BillingCountryField } from '@/components/host/billing-country-field'
import { PaidTermsAcceptance } from '@/components/host/paid-terms-acceptance'
import type { StepScreen } from '@/components/host/onboarding/onboarding-shell'
import { ShotsSelector } from '@/components/host/shots-selector'
import { PostEventUploadsField } from '@/components/host/post-event-uploads-field'
import { SwitchTrack } from '@/components/ui/switch'
import type { ShotOption } from '@/lib/camera'
import { FREE_PARTICIPANT_LIMIT, type EventPlan } from '@/lib/onboarding'
import { type BillingCountry, parseBillingCountry } from '@/lib/billing-country'
import { eventPriceLabelFor } from '@/lib/pricing'
import { localePath, type Locale } from '@/lib/i18n'
import { T, still } from '@/lib/motion'

/**
 * Guest count is the last decision. Roll length and gallery access keep their
 * draft defaults unless the host opens the optional settings. Both remain
 * editable after creation, so neither needs an answer before saving an event.
 */
export function guestsScreen({
  plan,
  setPlan,
  shots,
  setShots,
  guestsCanView,
  setGuestsCanView,
  postEventUploads,
  setPostEventUploads,
  legalAccepted,
  setLegalAccepted,
  paymentsEnabled,
  billingCountry,
  setBillingCountry,
  pending,
  locale,
}: {
  plan: EventPlan
  setPlan: (value: EventPlan) => void
  shots: ShotOption
  setShots: (value: ShotOption) => void
  guestsCanView: boolean
  setGuestsCanView: (value: boolean) => void
  postEventUploads: boolean
  setPostEventUploads: (value: boolean) => void
  legalAccepted: boolean
  setLegalAccepted: (value: boolean) => void
  /** Whether Stripe is switched on in this environment. When it is not, the
   *  paid tier is not offered — a price on a button that cannot charge is a
   *  worse answer than not showing the button. */
  paymentsEnabled: boolean
  /** Asked only on the paid tile, on this same screen — no extra step. */
  billingCountry: string | null
  setBillingCountry: (value: BillingCountry | null) => void
  pending: boolean
  locale: Locale
}): StepScreen {
  const en = locale === 'en'
  const country = parseBillingCountry(billingCountry)
  // The paid path cannot continue to Stripe without a country. One this
  // deployment cannot sell to still creates the event and lands on the
  // billing card, which says why. The free path never asks.
  const countryMissing = plan === 'full' && !country

  return {
    compact: true,
    eyebrow: en ? 'THE GUESTS' : 'A VENDÉGEK',
    title: en
      ? 'How many guests are you expecting?'
      : 'Hány vendégre számítasz?',
    cta:
      plan === 'full'
        ? en
          ? 'Continue to payment'
          : 'Tovább a fizetéshez'
        : en
          ? 'Create event'
          : 'Létrehozás',
    ctaDisabled: !legalAccepted || countryMissing,
    ctaPending: pending,
    note: <AccountNotice locale={locale} />,
    content: (
      <GuestsFields
        plan={plan}
        setPlan={setPlan}
        shots={shots}
        setShots={setShots}
        guestsCanView={guestsCanView}
        setGuestsCanView={setGuestsCanView}
        postEventUploads={postEventUploads}
        setPostEventUploads={setPostEventUploads}
        legalAccepted={legalAccepted}
        setLegalAccepted={setLegalAccepted}
        paymentsEnabled={paymentsEnabled}
        billingCountry={country}
        setBillingCountry={setBillingCountry}
        locale={locale}
      />
    ),
  }
}

function GuestsFields({
  plan,
  setPlan,
  shots,
  setShots,
  guestsCanView,
  setGuestsCanView,
  postEventUploads,
  setPostEventUploads,
  legalAccepted,
  setLegalAccepted,
  paymentsEnabled,
  billingCountry,
  setBillingCountry,
  locale,
}: {
  plan: EventPlan
  setPlan: (value: EventPlan) => void
  shots: ShotOption
  setShots: (value: ShotOption) => void
  guestsCanView: boolean
  setGuestsCanView: (value: boolean) => void
  postEventUploads: boolean
  setPostEventUploads: (value: boolean) => void
  legalAccepted: boolean
  setLegalAccepted: (value: boolean) => void
  paymentsEnabled: boolean
  billingCountry: BillingCountry | null
  setBillingCountry: (value: BillingCountry | null) => void
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
        {/* The number first. A host choosing between tiers is comparing two
              quantities, and "Legfeljebb 5" set in body copy buried the only
              part of the tile that answers the question. */}
        <div className="grid grid-cols-2 gap-2.5">
          <PlanTile
            value="free"
            plan={plan}
            setPlan={setPlan}
            figure={String(FREE_PARTICIPANT_LIMIT)}
            label={en ? 'GUESTS · FREE' : 'VENDÉGIG · INGYENES'}
            reduceMotion={reduceMotion}
          />
          <PlanTile
            value="full"
            plan={plan}
            setPlan={setPlan}
            figure="∞"
            label={`${en ? 'UNLIMITED' : 'KORLÁTLAN'} · ${
              paymentsEnabled
                ? // The price follows the billing country, so it appears once
                  // one is chosen. Non-breaking spaces inside it: Martian Mono
                  // is wide enough that this label wraps in a 134px card, and
                  // the one place it must never wrap is between the thousands
                  // and the hundreds — "12 / 900 FT" reads as two numbers.
                  billingCountry
                  ? eventPriceLabelFor(billingCountry)
                      .toUpperCase()
                      .replace(/ /g, '\u00a0')
                  : en
                    ? 'PAID'
                    : 'FIZETŐS'
                : en
                  ? 'COMING\u00a0SOON'
                  : 'HAMAROSAN'
            }`}
            disabled={!paymentsEnabled}
            reduceMotion={reduceMotion}
          />
        </div>
        {plan === 'full' && paymentsEnabled ? (
          <BillingCountryField
            locale={locale}
            value={billingCountry}
            onChange={setBillingCountry}
            suggested={null}
            className="mt-3.5"
          />
        ) : null}
      </fieldset>

      <details className="group border-t border-border">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 text-[13.5px] font-medium [&::-webkit-details-marker]:hidden">
          {en ? 'More settings' : 'További beállítások'}
          <ChevronDown
            className="size-4 shrink-0 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="flex flex-col gap-4.5 pt-1">
          <p className="text-[12px] leading-[1.5] text-muted-foreground">
            {en ? 'You can change these later.' : 'Később is módosítható.'}
          </p>
          <fieldset>
            <legend className="sr-only">
              {en ? 'Shots per guest' : 'Képek száma vendégenként'}
            </legend>
            <SectionLabel>
              {en ? 'PHOTOS PER GUEST' : 'FOTÓK VENDÉGENKÉNT'}
            </SectionLabel>
            <div className="mt-3">
              <ShotsSelector
                value={shots}
                onChange={setShots}
                name="shots_choice"
                locale={locale}
              />
            </div>
          </fieldset>

          <div className="border-t border-border pt-4.5">
            {/* A real label pair, with the switch to the right of it. The switch
              used to sit first with a single sentence beside it that changed
              underneath — which meant the control had no stable name, only a
              description of its current state. */}
            <button
              type="button"
              role="switch"
              aria-checked={guestsCanView}
              onClick={() => setGuestsCanView(!guestsCanView)}
              className="flex min-h-11 w-full items-center justify-between gap-4 text-left"
            >
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium">
                  {en
                    ? 'Guests can see the gallery'
                    : 'A vendégek látják a galériát'}
                </span>
                {/* Still optimistic, still on the label rather than the track:
                  a switch that sits still for a round trip is one a host taps
                  twice. */}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={guestsCanView ? 'visible' : 'private'}
                    initial={reduceMotion ? false : { opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -3 }}
                    transition={reduceMotion ? still : T.settle}
                    className="mt-0.5 block text-[12px] leading-snug text-pretty text-muted-foreground"
                  >
                    {guestsCanView
                      ? en
                        ? 'Turn off and only you see the photos.'
                        : 'Kikapcsolva csak te látod a képeket.'
                      : en
                        ? 'Only you can see the photos.'
                        : 'Most csak te látod a képeket.'}
                  </motion.span>
                </AnimatePresence>
              </span>
              <SwitchTrack checked={guestsCanView} />
            </button>
          </div>

          <div className="border-t border-border pt-4.5">
            <PostEventUploadsField
              enabled={postEventUploads}
              onChange={setPostEventUploads}
              locale={locale}
            />
          </div>
        </div>
      </details>

      <label className="flex min-h-11 cursor-pointer items-start gap-3 border-t border-border pt-4.5 text-[11.5px] leading-[1.6] text-muted-foreground">
        <input
          type="checkbox"
          checked={legalAccepted}
          onChange={(event) => setLegalAccepted(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
        />
        <span>
          {plan === 'full' ? (
            // The paid declaration, shared with the billing card so the two
            // cannot drift: it is the record that the ÁSZF was accepted and
            // that performance inside the 14-day period was expressly asked
            // for, which is the whole point of asking.
            <PaidTermsAcceptance locale={locale} />
          ) : (
            <>
              {en ? 'I accept the ' : 'Elfogadom az '}
              <Link
                href={localePath(locale, '/aszf')}
                target="_blank"
                className="underline underline-offset-2 hover:text-foreground"
              >
                {en ? 'Terms' : 'ÁSZF-et'}
              </Link>
              {en ? '. The ' : '. Az '}
              <Link
                href={localePath(locale, '/adatvedelem')}
                target="_blank"
                className="underline underline-offset-2 hover:text-foreground"
              >
                {en ? 'Privacy Notice' : 'adatkezelési tájékoztató'}
              </Link>{' '}
              {en
                ? 'explains how personal data is handled.'
                : 'ismerteti az adatok kezelését.'}
            </>
          )}
        </span>
      </label>
    </div>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="font-mono text-[9.5px] font-medium tracking-[0.2em] text-foreground/38">
      {children}
    </p>
  )
}

/**
 * One tier, led by its number.
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
  disabled = false,
  reduceMotion,
}: {
  value: EventPlan
  plan: EventPlan
  setPlan: (value: EventPlan) => void
  figure: string
  label: string
  disabled?: boolean
  reduceMotion: boolean | null
}) {
  const active = plan === value
  return (
    <label
      className={`relative flex flex-col justify-between rounded-lg px-4 py-3.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
        active
          ? 'border-[1.5px] border-transparent text-accent'
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
      <span className="relative z-10 font-mono text-[26px] leading-none font-medium tracking-[-0.04em]">
        {figure}
      </span>
      <span
        className={`relative z-10 mt-2 font-mono text-[9px] font-medium tracking-[0.14em] ${
          active ? 'text-accent' : 'text-foreground/55'
        }`}
      >
        {label}
      </span>
    </label>
  )
}
