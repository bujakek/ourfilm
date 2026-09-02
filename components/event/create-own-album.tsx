'use client'

import { dismissUpsell, upsellDismissed } from '@/lib/guest-prefs'
import { useGuestState } from '@/lib/use-guest-state'
import { Sparkles, X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { buttonVariants } from '@/components/ui/button'

/**
 * Invites a guest who has seen an album to host their own event next time.
 *
 * Rendered only from the gallery, and only once it has developed — so the
 * person reading it has just watched the product do the thing it promises,
 * which is the one moment the pitch is not in the way. It used to key off a
 * localStorage marker for "has uploaded here"; reaching a revealed gallery is
 * both a stronger signal and one the server already established.
 *
 * Dismissal is global and permanent: a guest who says no should not be asked
 * again at the next wedding.
 */
export function CreateOwnAlbum() {
  const eligible = useGuestState(() => !upsellDismissed(), false)
  // localStorage is not reactive, so dismissing needs local state to re-render.
  const [dismissed, setDismissed] = useState(false)

  if (!eligible || dismissed) return null

  return (
    <div className="glass relative mt-8 rounded-2xl p-6">
      <button
        type="button"
        onClick={() => {
          dismissUpsell()
          setDismissed(true)
        }}
        aria-label="Ajánlat bezárása"
        className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="size-4" aria-hidden="true" />
      </button>

      <span className="glass flex size-11 items-center justify-center rounded-lg">
        <Sparkles
          className="size-5 text-accent"
          strokeWidth={1.6}
          aria-hidden="true"
        />
      </span>

      <p className="mt-4 pr-8 text-base font-semibold text-balance">
        Szeretnél te is egy helyen megkapni minden képet?
      </p>
      <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
        A következő esküvőre, születésnapra vagy bulira készíts saját közös
        albumot. A vendégeid QR-kóddal csatlakoznak, app és regisztráció nélkül.
      </p>

      <Link
        href="/host/login"
        className={buttonVariants({ className: 'mt-5 w-full' })}
      >
        Saját album indítása — ingyen
      </Link>
    </div>
  )
}
