'use client'

import { dismissUpsell, upsellDismissed } from '@/lib/guest-prefs'
import type { Locale } from '@/lib/i18n'
import { useGuestState } from '@/lib/use-guest-state'
import { X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { track } from '@/lib/telemetry'

/**
 * Invites a guest who has seen an album to host their own event next time.
 *
 * Rendered only from the gallery, and only once it has developed — so the
 * person reading it has just watched the product do the thing it promises,
 * which is the one moment the pitch is not in the way. It used to key off a
 * localStorage marker for "has uploaded here"; reaching a revealed gallery is
 * both a stronger signal and one the server already established.
 *
 * A hairline bar under the grid, not a card on top of it. The card version
 * was a lilac icon, a bold question and a full-width button — a piece of
 * marketing sitting in a wedding album, and the reason the v2 review pulled
 * it apart. What is left says its piece in two lines and offers a text link;
 * the rule from that review is that it sits **below** the photos, never above
 * them and never over one.
 *
 * Dismissal is global and permanent: a guest who says no should not be asked
 * again at the next wedding. The v2 handoff specifies per-event dismissal
 * instead, which would ask the same person again at every event they attend;
 * that is a deliberate deviation, not an oversight.
 */
export function CreateOwnAlbum({
  eventId,
  locale,
}: {
  /** The album the guest is looking at. Telemetry only. */
  eventId: string
  locale: Locale
}) {
  const en = locale === 'en'
  const eligible = useGuestState(() => !upsellDismissed(), false)
  // localStorage is not reactive, so dismissing needs local state to re-render.
  const [dismissed, setDismissed] = useState(false)

  if (!eligible || dismissed) return null

  return (
    <div className="mt-6.5 flex items-start gap-3 border-t border-border pt-4">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold">
          {en ? 'Your own album' : 'Saját album'}
        </p>
        <p className="mt-[7px] text-[12.5px] leading-[1.65] text-pretty text-muted-foreground">
          {en
            ? 'You can run a camera like this at your next wedding or party. Your guests join with a QR code, no app and no sign-up.'
            : 'A következő esküvőre vagy bulira te is indíthatsz egy OurFilm-kamerát. A vendégeid QR-kóddal csatlakoznak, app és regisztráció nélkül.'}
        </p>

        {/* The guest-to-host loop, and the only growth mechanism the product
            has. It went unmeasured for months because nothing mounted this
            component; the gallery below the grid is where it mounts now. */}
        <Link
          href="/host/login"
          onClick={() =>
            track('create_own_album_clicked', { event_id: eventId })
          }
          className="inline-flex min-h-9 items-center text-[12.5px] font-semibold text-foreground underline decoration-foreground/35 underline-offset-[3px]"
        >
          {en ? 'See how it works' : 'Megnézem, hogyan működik'}
        </Link>
      </div>

      <button
        type="button"
        onClick={() => {
          dismissUpsell()
          setDismissed(true)
        }}
        aria-label={en ? 'Hide this suggestion' : 'Ajánlat elrejtése'}
        className="-mt-1.5 -mr-2 flex size-9 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="size-[13px]" aria-hidden="true" />
      </button>
    </div>
  )
}
