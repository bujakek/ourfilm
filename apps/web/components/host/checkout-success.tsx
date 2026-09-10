import { CheckoutSettlePoller } from '@/components/host/checkout-settle-poller'
import { buttonVariants } from '@/components/ui/button'
import type { Locale } from '@/lib/i18n'
import { localeTag } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import Link from 'next/link'

/**
 * What the server was able to establish about the payment, which is not the
 * same question as "did Stripe redirect here".
 *
 * `paid` is the only one that celebrates, and it is read from
 * `getEventQuota().unlimited` — the same predicate `join_event` enforces —
 * never from the query string. A host can type `?checkout=success`; they
 * cannot type a `purchases` row into existence.
 */
export type CheckoutOutcome = 'paid' | 'settling' | 'unconfirmed'

type Props = {
  locale: Locale
  slug: string
  outcome: CheckoutOutcome
  /** The host's chosen roll, named because paying never changes it. */
  shots: number
  /**
   * The receipt line from `planNote()`, or null when there is nothing
   * truthful to put there. Never assembled here: an event that is uncapped
   * for some other reason must not read "Kifizetve — 12 900 Ft".
   */
  note: string | null
}

/**
 * The screen a host lands on after paying for one event.
 *
 * Modelled on Kombai's "Offhand" acknowledgement screen: a bare near-black
 * canvas, one soft vignette, an emoji tile, a short exclamatory headline, one
 * line of warm subtext, and a single cream pill pinned to the bottom. The
 * palette needed nothing new — Offhand's cream-on-near-black button is exactly
 * `--primary` on `--background`, and its `cubic-bezier(0.16,1,0.3,1)` is the
 * ease already baked into this project's surfaces.
 *
 * Deliberately no lilac. `--accent` means the film is live — an open capture
 * window, a developed gallery — and a billing receipt is neither.
 *
 * A Server Component, because every word here is chosen from state only the
 * server can read. `CheckoutSettlePoller` is the one part that runs in the
 * browser, and only while there is a webhook to wait for.
 */
export function CheckoutSuccess({ locale, slug, outcome, shots, note }: Props) {
  const en = locale === 'en'
  const copy = outcomeCopy(outcome, locale, shots)

  return (
    <main
      lang={localeTag[locale]}
      className="relative mx-auto flex min-h-[100svh] w-full max-w-md flex-col px-6 pt-14 pb-10 text-center"
    >
      {/* Offhand's single light source: a wide, very faint wash behind the
          headline. 4% white, which is the same order as `.glass` — texture
          rather than a colour this design system would have to name. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(74%_32%_at_50%_43%,rgba(255,255,255,0.04),transparent_70%)]"
      />

      <div className="relative flex flex-1 flex-col items-center justify-center">
        <span
          className="glass flex size-[5.375rem] items-center justify-center rounded-2xl"
          role="img"
          aria-label={copy.iconLabel}
        >
          <span className="text-[2.625rem] leading-none drop-shadow-[0_3px_8px_rgba(0,0,0,0.4)]">
            {copy.icon}
          </span>
        </span>

        <h1 className="mt-[0.625rem] text-4xl leading-[1.06] font-extrabold tracking-[-0.032em] text-balance">
          {copy.headline}
        </h1>

        <p className="mt-[0.8125rem] max-w-[24.75rem] text-xl leading-[1.2] font-medium tracking-[-0.018em] text-pretty text-muted-foreground sm:text-[1.4375rem]">
          {copy.body}
        </p>

        {outcome === 'paid' && note ? (
          <p className="mt-5 text-xs text-muted-foreground/80">{note}</p>
        ) : null}
      </div>

      <div className="relative mt-auto flex flex-col items-center gap-4 pt-10">
        <Link
          href={`/host/events/${slug}?lang=${locale}`}
          className={cn(
            buttonVariants({ size: 'lg' }),
            'h-[3.9375rem] w-full rounded-xl text-[1.09375rem] tracking-[-0.015em]',
          )}
        >
          {copy.cta}
        </Link>

        <Link
          href={`/host/events/${slug}/settings?lang=${locale}#billing`}
          className="min-h-11 py-3 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          {en ? 'Billing details' : 'Számlázási részletek'}
        </Link>
      </div>

      {outcome === 'settling' ? <CheckoutSettlePoller /> : null}
    </main>
  )
}

/**
 * One entry per outcome, both languages side by side, so a state cannot end up
 * saying something in Hungarian that it does not say in English.
 *
 * Only `paid` may claim the money arrived. `settling` describes the wait
 * without asserting it succeeded, and `unconfirmed` says plainly that we do not
 * know yet — because from a redirect alone, we do not.
 *
 * `shots` is interpolated here rather than passed through to the markup so the
 * sentence stays one string per language; the roll is the detail that keeps the
 * celebration honest about what was bought. Paying admits more guests. It never
 * hands anybody more film.
 */
function outcomeCopy(outcome: CheckoutOutcome, locale: Locale, shots: number) {
  const en = locale === 'en'

  if (outcome === 'paid') {
    return {
      icon: '🎉',
      iconLabel: en ? 'party popper' : 'konfetti',
      headline: en ? 'Event unlocked!' : 'Az esemény feloldva!',
      body: en
        ? `Everyone you invite can join now — and each of them still gets their own roll of ${shots}.`
        : `Mostantól bárki csatlakozhat, akit meghívsz — és mindenki a saját ${shots} kockás tekercsét kapja.`,
      cta: en ? 'Back to your event' : 'Vissza az eseményhez',
    }
  }

  return {
    icon: '⏳',
    iconLabel: en ? 'hourglass' : 'homokóra',
    headline:
      outcome === 'settling'
        ? en
          ? 'Almost there…'
          : 'Mindjárt kész…'
        : en
          ? 'Not confirmed yet'
          : 'Még nincs visszaigazolva',
    body:
      outcome === 'settling'
        ? en
          ? 'We are confirming the payment. This usually takes a few seconds, and the page updates on its own.'
          : 'Épp visszaigazoljuk a fizetést. Ez általában néhány másodperc, az oldal magától frissül.'
        : en
          ? 'If you were charged, the event unlocks by itself within a few minutes. Nothing is lost either way.'
          : 'Ha megtörtént a terhelés, az esemény pár percen belül magától feloldódik. Semmi nem vész el.',
    cta: en ? 'Back to your event' : 'Vissza az eseményhez',
  }
}
