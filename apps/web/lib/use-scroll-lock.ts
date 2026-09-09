'use client'

import { useEffect } from 'react'

/**
 * Hold the page still while something is open on top of it.
 *
 * A modal `<dialog>` makes the document inert, which stops clicks and focus —
 * but not scrolling. A touch that starts on the backdrop, or anywhere the
 * overlay has nothing of its own to scroll, chains straight through to the
 * document behind it, so opening a photo and dragging moved the grid
 * underneath.
 *
 * **`position: fixed` on the body, not `overflow: hidden`.** The one-line
 * version works on desktop and is quietly ignored by iOS Safari, which is the
 * browser this actually matters in: the guest surface is a phone, and the host
 * opens their album on one. Fixing the body is the approach that holds there,
 * and it costs the scroll position — hence saving and restoring it, which is
 * the entire reason this is a module rather than two lines in a component.
 *
 * Counted, so two locked surfaces at once do not release each other. Nothing
 * nests these today; the counter is what stops the first one that closes from
 * handing the page back while the second is still open.
 */
let locks = 0
let restoreTo = 0

export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return

    if (locks === 0) {
      restoreTo = window.scrollY
      const { style } = document.body
      style.position = 'fixed'
      style.top = `-${restoreTo}px`
      style.left = '0'
      style.right = '0'
      style.width = '100%'
    }
    locks += 1

    return () => {
      locks -= 1
      if (locks > 0) return

      const { style } = document.body
      style.position = ''
      style.top = ''
      style.left = ''
      style.right = ''
      style.width = ''
      // Instant, and before the next paint: an animated restore would show the
      // page racing back to where the host left it.
      window.scrollTo({ top: restoreTo, behavior: 'instant' })
    }
  }, [active])
}
