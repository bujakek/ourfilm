'use client'

import { useOptimistic, useState, useTransition } from 'react'

import { setEventLocale } from '@/app/(product)/host/events/[slug]/actions'
import { type Locale, localeLabel, locales } from '@/lib/i18n'
import { eventPriceLabel } from '@/lib/pricing'

/**
 * The language the guests read this event in.
 *
 * **Separate from the host's own language, and the copy has to say so.** The
 * toggle in the `/host` header changes what the *host* reads; this changes
 * what a guest sees after scanning the QR code. They are usually the same and
 * occasionally must not be — a Hungarian host running an English-language
 * wedding holds a Hungarian dashboard and an English camera — so a card that
 * did not distinguish them would read as a duplicate of the header toggle.
 *
 * Optimistic, like `ShotsCard` and for the same reason: a choice whose
 * selected value is visible at a glance cannot mislead by showing the answer
 * before the round trip lands. It reverts on its own if the action throws.
 *
 * **The currency line is the part a host must not discover later.** The
 * event's locale selects the Stripe Price, so switching an unpaid event
 * changes what the next checkout charges. It is shown only while the event is
 * still unpaid: once a purchase exists the ledger records what was actually
 * charged, nothing here rewrites it, and quoting a price to somebody who has
 * already paid would be a worse lie than saying nothing.
 */
export function EventLocaleCard({
  slug,
  locale,
  hostLocale,
  unlimited,
}: {
  slug: string
  /** The event's stored locale — what guests read. */
  locale: Locale
  /** The host's own language, which this card is rendered in. */
  hostLocale: Locale
  /** Whether the event is already on the full plan, paid or granted. */
  unlimited: boolean
}) {
  const en = hostLocale === 'en'
  const [pending, startTransition] = useTransition()
  const [failed, setFailed] = useState(false)
  const [optimisticLocale, setOptimisticLocale] = useOptimistic(locale)

  return (
    <div className="glass rounded-2xl px-5 py-4">
      <p className="font-medium">
        {en ? 'Guest language' : 'A vendégek nyelve'}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {en
          ? 'What your guests see on the camera and in the gallery. Your own dashboard language is separate — change that in the header on your events page.'
          : 'Ezt látják a vendégeid a kamerán és a galériában. A saját felületed nyelve ettől független — azt az eseményeid oldalán, a fejlécben állíthatod.'}
      </p>

      <fieldset disabled={pending} className="mt-4 flex flex-col gap-2">
        <legend className="sr-only">
          {en ? 'Guest language' : 'A vendégek nyelve'}
        </legend>

        {locales.map((option) => {
          const selected = option === optimisticLocale
          return (
            <label
              key={option}
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-4 text-sm transition-colors ${
                selected
                  ? 'border-strong text-foreground'
                  : 'hover:border-strong border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <input
                type="radio"
                name="event-locale"
                value={option}
                checked={selected}
                onChange={() =>
                  startTransition(async () => {
                    setFailed(false)
                    setOptimisticLocale(option)
                    try {
                      await setEventLocale(slug, option)
                    } catch {
                      setFailed(true)
                    }
                  })
                }
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`size-2 rounded-full ${selected ? 'bg-accent' : 'bg-white/20'}`}
              />
              {/* Names the language of the label itself, so "Magyar" is not
                  announced with an English voice. */}
              <span lang={option}>{localeLabel[option]}</span>
            </label>
          )
        })}
      </fieldset>

      {!unlimited ? (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {en
            ? `This also sets the price if you upgrade: ${eventPriceLabel(optimisticLocale)}.`
            : `Ez határozza meg a bővítés árát is: ${eventPriceLabel(optimisticLocale)}.`}
        </p>
      ) : null}

      {failed ? (
        <p className="mt-2 text-xs text-destructive">
          {en ? 'Could not save changes.' : 'Nem sikerült módosítani.'}
        </p>
      ) : null}
    </div>
  )
}
