'use client'

import { dismissUpsell, hasUploadedTo, upsellDismissed } from '@/lib/guest-name'
import { useGuestState } from '@/lib/use-guest-state'
import { Sparkles, X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

/**
 * Invites a guest who has just contributed to host their own event next time.
 *
 * Shown only after this device has actually uploaded here — pitching an album
 * to someone who has not yet used the one they were handed is both premature
 * and in the way. Dismissal is global and permanent: a guest who says no
 * should not be asked again at the next wedding.
 *
 * `alwaysShow` skips the upload check for the post-upload success panel, where
 * the upload that qualifies them has just happened in this same session.
 */
export function CreateOwnAlbum({
  eventId,
  alwaysShow = false,
}: {
  eventId: string
  alwaysShow?: boolean
}) {
  const eligible = useGuestState(
    () => !upsellDismissed() && (alwaysShow || hasUploadedTo(eventId)),
    false,
  )
  // localStorage is not reactive, so dismissing needs local state to re-render.
  const [dismissed, setDismissed] = useState(false)

  if (!eligible || dismissed) return null

  return (
    <div className="glass relative mt-8 rounded-3xl p-6">
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

      <span className="glass flex size-11 items-center justify-center rounded-2xl">
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
        href="/admin/login"
        className="btn-shine mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02]"
      >
        Saját album indítása — ingyen
      </Link>
    </div>
  )
}
