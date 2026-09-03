'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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
  iconOnly = false,
}: {
  url: string
  locale?: Locale
  /**
   * The guest surface's shape: a 58px bordered square beside the shutter, with
   * no label. The whole share/clipboard mechanism below is unchanged — what
   * goes is `.glass` (no longer what a secondary control wears) and the word,
   * which was competing with the one button on the screen that matters. The
   * copied state still reads as a tick, and the `aria-live` line below still
   * announces it.
   */
  iconOnly?: boolean
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

  const announcement = (
    <span aria-live="polite" className="sr-only">
      {copied
        ? en
          ? 'Link copied to clipboard'
          : 'Link kimásolva a vágólapra'
        : ''}
    </span>
  )

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={invite}
        aria-label={en ? 'Share invite link' : 'Meghívólink megosztása'}
        className={cn(
          'flex size-[58px] shrink-0 items-center justify-center rounded-xl border border-white/15 transition-colors hover:border-white/30',
          copied ? 'text-accent' : 'text-foreground/75',
        )}
      >
        {copied ? (
          <Check className="size-5" strokeWidth={2.2} aria-hidden="true" />
        ) : (
          <Share2
            className="size-[18px]"
            strokeWidth={1.8}
            aria-hidden="true"
          />
        )}
        {announcement}
      </button>
    )
  }

  return (
    <Button
      type="button"
      onClick={invite}
      aria-label={en ? 'Share invite link' : 'Meghívólink megosztása'}
      variant="secondary"
      size="lg"
      className={cn(
        'w-full px-3 text-sm',
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
      {announcement}
    </Button>
  )
}
