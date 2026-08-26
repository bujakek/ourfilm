'use client'

import { Check } from 'lucide-react'

import { AccountNotice } from '@/components/admin/onboarding/account-notice'
import {
  OnboardingShell,
  type OnboardingNav,
} from '@/components/admin/onboarding/onboarding-shell'
import { DEFAULT_SHOTS, SHOT_OPTIONS, type ShotOption } from '@/lib/camera'
import { FREE_PARTICIPANT_LIMIT, type EventPlan } from '@/lib/onboarding'
import { EVENT_PRICE_LABEL } from '@/lib/pricing'

/**
 * The last screen: how many guests, how long a roll, and who may look.
 *
 * Three answers on one screen rather than three screens, because they are the
 * same decision seen from three sides — how big is this party, and how much
 * film does it need. None of them is a question a host has to think about
 * before the previous one, and each on its own would be a screen with one
 * control on it.
 *
 * **The guest count is a plan, not a setting.** There is no `max_participants`
 * column: the free tier is five distinct participants, enforced inside
 * `join_event`'s row lock, and paying lifts it. So choosing "Korlátlan" here
 * does not write anything different — it sends the host to Stripe right after
 * the event is created, and the event is a normal free one until the webhook
 * says otherwise.
 */
export function StepGuests({
  nav,
  plan,
  setPlan,
  shots,
  setShots,
  guestsCanView,
  setGuestsCanView,
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
  /** Whether Stripe is switched on in this environment. When it is not, the
   *  paid tier is not offered — a price on a button that cannot charge is a
   *  worse answer than not showing the button. */
  paymentsEnabled: boolean
  pending: boolean
}) {
  return (
    <OnboardingShell
      {...nav}
      title="Hány vendéged lesz?"
      detail="Mindenki kapjon esélyt, hogy elkapja a pillanatot."
      // The label says what actually happens next, because the two answers are
      // different journeys: one ends on the host's own event, the other on
      // Stripe. A host who is about to be asked for a card should read that on
      // the button, not discover it after pressing it.
      cta={plan === 'full' ? 'Tovább a fizetéshez' : 'Létrehozás'}
      ctaPending={pending}
      note={<AccountNotice />}
    >
      {/* Top-aligned, not centred: three stacked sections read as a list that
          starts under the question, and centring them leaves a gap above as
          well as below — which makes the screen look like it failed to load
          something. The slack belongs at the bottom, above the CTA. */}
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
            />
            <PlanTile
              value="full"
              plan={plan}
              setPlan={setPlan}
              title="Korlátlan"
              detail={paymentsEnabled ? EVENT_PRICE_LABEL : 'Hamarosan'}
              disabled={!paymentsEnabled}
            />
          </div>
        </fieldset>

        <fieldset className="border-t border-border pt-5">
          <SectionLabel>KÉPEK VENDÉGENKÉNT</SectionLabel>
          <legend className="sr-only">Képek száma vendégenként</legend>
          {/* One row of five rather than the wrapped three-over-two this step
              used when it was alone on the screen. Three sections now share the
              height, and five 63px tiles are still a comfortable thumb target. */}
          <div className="mt-3 grid grid-cols-5 gap-2">
            {SHOT_OPTIONS.map((option) => {
              const active = option === shots
              return (
                <label
                  key={option}
                  className={`glass flex min-h-16 cursor-pointer items-center justify-center rounded-[1.1rem] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                    active
                      ? 'bg-accent/10 text-lg font-bold text-accent ring-2 ring-accent'
                      : 'text-base font-medium'
                  }`}
                >
                  <input
                    type="radio"
                    name="shots_choice"
                    value={option}
                    checked={active}
                    onChange={() => setShots(option)}
                    className="sr-only"
                  />
                  {option}
                  {/* The default is preselected, which is how the recommendation
                      is made — there is no room on a 63px tile for a word, and
                      an unasked-for answer already sitting there says it. */}
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
            <span
              aria-hidden="true"
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                guestsCanView ? 'bg-accent' : 'bg-muted-foreground/30'
              }`}
            >
              <span
                className={`absolute top-1 size-5 rounded-full bg-white transition-transform ${
                  guestsCanView ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </span>
            <span className="text-sm leading-snug text-pretty">
              {guestsCanView
                ? 'A vendégek is látják az összes képet.'
                : 'Csak te látod a képeket.'}
            </span>
          </button>
        </div>
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
}: {
  value: EventPlan
  plan: EventPlan
  setPlan: (value: EventPlan) => void
  title: string
  detail: string
  disabled?: boolean
}) {
  const active = plan === value
  return (
    <label
      className={`glass flex min-h-20 flex-col items-center justify-center gap-0.5 rounded-[1.25rem] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
        disabled
          ? 'cursor-not-allowed opacity-40'
          : `cursor-pointer ${active ? 'bg-accent/10 text-accent ring-2 ring-accent' : ''}`
      }`}
    >
      <input
        type="radio"
        name="plan_choice"
        value={value}
        checked={active}
        disabled={disabled}
        onChange={() => setPlan(value)}
        className="sr-only"
      />
      {/* The check carries the selection alongside the ring, so the choice is
          not signalled by colour alone. */}
      <span className="flex items-center gap-1.5 text-base font-semibold">
        {active ? (
          <Check className="size-4" strokeWidth={2.4} aria-hidden="true" />
        ) : null}
        {title}
      </span>
      <span
        className={`text-xs ${active ? 'text-accent/80' : 'text-muted-foreground'}`}
      >
        {detail}
      </span>
    </label>
  )
}
