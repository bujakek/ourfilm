'use client'

import { useOptimistic, useState, useTransition } from 'react'

import { setAccountLocale } from '@/app/(product)/host/actions'
import { type Locale, localeLabel, locales } from '@/lib/i18n'

/**
 * The host's own language, in the header where they already are.
 *
 * There is no `/host/settings` route, and inventing one for a single two-value
 * choice would be worse than a toggle sitting where the host already is. It is
 * next to Sign out for the same reason that is there: account-level actions,
 * as opposed to everything else on the page, which is about one event.
 *
 * **This is not the event's language.** `events.locale` is what the guests
 * read and it selects the Stripe Price; this is what the *host* reads. A
 * Hungarian host running an English-language wedding wants exactly that
 * split, so the two are never written together.
 *
 * Optimistic, like the host area's other small switches: a two-value choice
 * whose selected value is visible at a glance cannot mislead by showing the
 * answer early, and a control that sits still for a round trip is one a host
 * taps twice. It falls back on its own if the action throws — and because
 * every label on the page is server-rendered from the stored locale, the
 * revalidation is what actually translates the screen a moment later.
 *
 * Rendered as radios rather than buttons so a screen reader announces it as
 * one choice with two options and reports which is selected, and so arrow keys
 * move between them.
 */
export function LanguageToggle({ locale }: { locale: Locale }) {
  const [pending, startTransition] = useTransition()
  const [failed, setFailed] = useState(false)
  const [optimisticLocale, setOptimisticLocale] = useOptimistic(locale)

  return (
    <fieldset
      disabled={pending}
      className="flex items-center rounded-full border border-white/14 p-0.5"
    >
      <legend className="sr-only">
        {optimisticLocale === 'en' ? 'Language' : 'Nyelv'}
      </legend>

      {locales.map((option) => {
        const selected = option === optimisticLocale
        return (
          <label
            key={option}
            className={`flex min-h-9 cursor-pointer items-center rounded-full px-3 text-[12px] font-medium transition-colors ${
              selected
                ? 'bg-white/12 text-foreground'
                : 'text-foreground/60 hover:text-foreground'
            }`}
          >
            <input
              type="radio"
              name="account-locale"
              value={option}
              checked={selected}
              // `hrefLang`'s attribute twin: names the language of the label
              // itself, so "Magyar" is not read out with an English voice.
              lang={option}
              onChange={() =>
                startTransition(async () => {
                  setFailed(false)
                  setOptimisticLocale(option)
                  try {
                    await setAccountLocale(option)
                  } catch {
                    setFailed(true)
                  }
                })
              }
              className="sr-only"
            />
            {localeLabel[option]}
          </label>
        )
      })}

      {failed ? (
        <span role="status" className="sr-only">
          {optimisticLocale === 'en'
            ? 'Could not change the language.'
            : 'Nem sikerült nyelvet váltani.'}
        </span>
      ) : null}
    </fieldset>
  )
}
