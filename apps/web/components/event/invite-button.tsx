'use client'

import { Check, Share2 } from 'lucide-react'
import { useState } from 'react'
import type { Locale } from '@/lib/i18n'
import { track } from '@/lib/telemetry'

/**
 * Lets a guest forward the album link.
 *
 * This grants no new access. The album has no gate — anyone holding the link
 * is already in — so a guest could always paste it into a group chat. The
 * button only removes the step of finding the URL, which on a phone means
 * leaving the page to get at the address bar.
 *
 * Bulk download stays host-only. Forwarding one link and exporting the whole
 * archive are different actions, and the host owns the archive.
 */
export function InviteButton({
  url,
  eventId,
  locale = 'hu',
}: {
  url: string
  /** For telemetry only. The link itself is never reported — it contains the
   *  slug, which is the album's whole lock. */
  eventId: string
  locale?: Locale
}) {
  const en = locale === 'en'
  const [copied, setCopied] = useState(false)

  const invite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ url })
        // The sheet opened and was not dismissed. Whether the guest then chose
        // a recipient is not something the API reports, and nothing here
        // pretends otherwise — this is the link leaving the page, which is the
        // step that was previously invisible.
        track('invite_shared', {
          event_id: eventId,
          surface: 'guest',
          method: 'share_sheet',
        })
        return
      } catch (error) {
        // Closing the native sheet is a complete, normal outcome. Only a real
        // share failure falls through to the clipboard fallback.
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      track('invite_shared', {
        event_id: eventId,
        surface: 'guest',
        method: 'clipboard',
      })
    } catch {
      // Clipboard needs a secure context and can still be refused. Nothing
      // useful to offer here beyond leaving the button as it was.
      //
      // Worth reporting rather than shrugging at: from the guest's side the
      // button simply does nothing, and an event where the link cannot be
      // forwarded at all is an event nobody else joins.
      track('invite_shared', {
        event_id: eventId,
        surface: 'guest',
        method: 'unavailable',
      })
    }
  }

  const announcement = (
    <span aria-live="polite" className="sr-only">
      {copied
        ? en
          ? 'Link copied to clipboard'
          : 'Link kimásolva a vágólapra'
        : ''}
    </span>
  )

  // The guest surface's shape: a 58px square beside the shutter, with no
  // label, so it does not compete with the one button on the screen that
  // matters. A tile like every other secondary control in the landing look,
  // and no border. The copied state reads as a tick, and the `aria-live`
  // line announces it.
  return (
    <button
      type="button"
      onClick={invite}
      aria-label={en ? 'Share invite link' : 'Meghívólink megosztása'}
      className="flex size-[58px] shrink-0 items-center justify-center rounded-[16px] bg-host-tile text-white transition-colors duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-white/10"
    >
      {copied ? (
        <Check className="size-5" strokeWidth={2.2} aria-hidden="true" />
      ) : (
        <Share2 className="size-[18px]" strokeWidth={1.8} aria-hidden="true" />
      )}
      {announcement}
    </button>
  )
}
