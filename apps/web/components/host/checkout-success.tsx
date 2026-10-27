import { CheckoutSettlePoller } from '@/components/host/checkout-settle-poller'
import {
  HOST_PRIMARY,
  HOST_TILE,
  HOST_TITLE,
} from '@/components/host/ui/classes'
import type { Locale } from '@/lib/i18n'
import { localeTag } from '@/lib/i18n'
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
 * A bare near-black canvas, one soft vignette, an emoji tile, a short headline
 * in the display face, one line of subtext, and the screen's one white button
 * pinned to the bottom.
 *
 * Deliberately no sky. On host screens sky is a pay button or live state, and
 * a receipt is neither; the payment is already behind the host.
 *
 * A Server Component, because every word here is chosen from state only the
 * server can read. `CheckoutSettlePoller` is the one part that runs in the
 * browser, and only while there is a webhook to wait for.
 */
export function CheckoutSuccess({ locale, slug, outcome, shots, note }: Props) {
  const copy = outcomeCopy(outcome, locale, shots)

  return (
    <main
      lang={localeTag[locale]}
      className="relative mx-auto flex min-h-[100svh] w-full max-w-md flex-col px-6 pt-14 pb-10 text-center"
    >
      {/* Offhand's single light source: a wide, very faint wash behind the
          headline. 4% white, the same order as a host panel — texture rather
          than a colour this design system would have to name. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(74%_32%_at_50%_43%,rgba(255,255,255,0.04),transparent_70%)]"
      />

      <div className="relative flex flex-1 flex-col items-center justify-center">
        <span
          className={`flex size-[5.375rem] items-center justify-center ${HOST_TILE}`}
          role="img"
          aria-label={copy.iconLabel}
        >
          <span className="text-[2.625rem] leading-none drop-shadow-[0_3px_8px_rgba(0,0,0,0.4)]">
            {copy.icon}
          </span>
        </span>

        <h1 className={`mt-5 ${HOST_TITLE}`}>{copy.headline}</h1>

        <p className="mt-3 max-w-[24.75rem] text-[17px] leading-[1.5] text-pretty text-white/70">
          {copy.body}
        </p>

        {outcome === 'paid' && note ? (
          <p className="mt-5 text-[13px] text-white/65">{note}</p>
        ) : null}
      </div>

      <div className="relative mt-auto flex flex-col items-center gap-4 pt-10">
        <Link
          href={`/host/events/${slug}?lang=${locale}`}
          className={`${HOST_PRIMARY} w-full`}
        >
          {copy.cta}
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
      headline: en ? 'Event unlocked!' : 'Nincs több vendégkorlát!',
      body: en
        ? `Everyone you invite can join now — and each of them still gets their own roll of ${shots}.`
        : `Mostantól bárki csatlakozhat, akit meghívsz. Minden vendég továbbra is ${shots} képet készíthet.`,
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
          : 'A fizetés még nincs visszaigazolva',
    body:
      outcome === 'settling'
        ? en
          ? 'We are confirming the payment. This usually takes a few seconds, and the page updates on its own.'
          : 'Még várjuk a fizetés visszaigazolását. Ez általában csak néhány másodpercig tart. Az oldal magától frissül.'
        : en
          ? 'If you were charged, the event unlocks by itself within a few minutes. Nothing is lost either way.'
          : 'Ha levonták az összeget, a vendégkorlát néhány percen belül automatikusan megszűnik. Nem kell újra fizetned.',
    cta: en ? 'Back to your event' : 'Vissza az eseményhez',
  }
}
