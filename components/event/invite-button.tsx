'use client'

import { cn } from '@/lib/utils'
import { Check, Share2 } from 'lucide-react'
import { useState } from 'react'

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
export function InviteButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  const invite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ url })
        return
      } catch {
        // Cancelling the share sheet rejects with AbortError, which is a
        // normal outcome and must not surface as a failure. Anything else
        // (no permission, unsupported payload) falls through to the copy path.
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard needs a secure context and can still be refused. Nothing
      // useful to offer here beyond leaving the button as it was.
    }
  }

  return (
    <button
      type="button"
      onClick={invite}
      // Icon-only at rest, so it needs a real name for anyone who cannot see
      // the glyph. 44px minimum — this is a thumb target on a phone.
      aria-label="Meghívólink megosztása"
      className={cn(
        'glass glass-hover inline-flex min-h-11 items-center justify-center gap-2 rounded-full text-sm font-medium transition-all',
        // Grows to carry the confirmation, then collapses back. Without the
        // text the clipboard fallback would succeed completely silently.
        copied ? 'px-4' : 'size-11',
      )}
    >
      {copied ? (
        <>
          <Check
            className="size-4 text-accent"
            strokeWidth={2.2}
            aria-hidden="true"
          />
          Link kimásolva
        </>
      ) : (
        <Share2 className="size-5" strokeWidth={1.8} aria-hidden="true" />
      )}
      {/* Announced rather than shown: a screen reader never sees the visible
          swap above, so the confirmation needs its own live region. */}
      <span aria-live="polite" className="sr-only">
        {copied ? 'Link kimásolva a vágólapra' : ''}
      </span>
    </button>
  )
}
