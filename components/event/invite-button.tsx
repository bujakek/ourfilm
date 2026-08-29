'use client'

import { cn } from '@/lib/utils'
import { Check, Share2 } from 'lucide-react'
import { useState } from 'react'
import type { Locale } from '@/lib/i18n'

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
  locale = 'hu',
}: {
  url: string
  locale?: Locale
}) {
  const en = locale === 'en'
  const [copied, setCopied] = useState(false)

  const invite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ url })
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
    } catch {
      // Clipboard needs a secure context and can still be refused. Nothing
      // useful to offer here beyond leaving the button as it was.
    }
  }

  return (
    <button
      type="button"
      onClick={invite}
      aria-label={en ? 'Share invite link' : 'Meghívólink megosztása'}
      className={cn(
        'glass glass-hover inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl px-3 text-sm font-medium transition-all',
        copied ? 'text-accent' : 'text-foreground',
      )}
    >
      {copied ? (
        <>
          <Check
            className="size-4 text-accent"
            strokeWidth={2.2}
            aria-hidden="true"
          />
          {en ? 'Link copied' : 'Link másolva'}
        </>
      ) : (
        <>
          <Share2 className="size-5" strokeWidth={1.8} aria-hidden="true" />
          {en ? 'Invite' : 'Meghívás'}
        </>
      )}
      <span aria-live="polite" className="sr-only">
        {copied
          ? en
            ? 'Link copied to clipboard'
            : 'Link kimásolva a vágólapra'
          : ''}
      </span>
    </button>
  )
}
