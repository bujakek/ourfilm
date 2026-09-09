import 'client-only'

/**
 * Share sends the link, not a picture of it.
 *
 * The QR code is for the wall of a venue — something a guest points a phone at
 * — and it is the wrong object to put in a chat, where the recipient is
 * already holding the phone and would have to scan an image off a second
 * screen to get anywhere. What belongs in a message is the address, tappable.
 *
 * Desktop has no share sheet, so the fallback is the clipboard: the same
 * outcome, by hand. Returns what actually happened, because the caller reports
 * it — a host whose link never reaches anybody has no guests, and this is the
 * first place that can go wrong.
 */
export type ShareOutcome =
  /** The OS sheet opened and was not dismissed. */
  | 'share_sheet'
  /** No share sheet, but the address is on the clipboard. */
  | 'clipboard'
  /** The host closed the sheet. A complete, normal outcome — not a failure. */
  | 'dismissed'
  /** Neither worked. The address is still on screen above the buttons. */
  | 'unavailable'

export async function shareEventLink({
  url,
  title,
}: {
  url: string
  title: string
}): Promise<ShareOutcome> {
  if (navigator.share && (navigator.canShare?.({ url }) ?? true)) {
    try {
      await navigator.share({ title, url })
      return 'share_sheet'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'dismissed'
      }
      // A real failure falls through to the clipboard.
    }
  }

  try {
    await navigator.clipboard.writeText(url)
    return 'clipboard'
  } catch {
    return 'unavailable'
  }
}
