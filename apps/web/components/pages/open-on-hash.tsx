'use client'

import { useEffect } from 'react'

/**
 * Opens the `<details>` a URL fragment names, and brings it into view.
 *
 * The withdrawal and removal forms sit inside closed rows so the contact page
 * reads like the approved design, but the footer, the legal pages and emails
 * link straight to `#elallas` and `#kepeltavolitas`. A link to a form must
 * land on an open form, not on a folded row.
 */
export function OpenOnHash({ ids }: { ids: readonly string[] }) {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1))
      if (!ids.includes(id)) return
      const el = document.getElementById(id)
      if (el instanceof HTMLDetailsElement && !el.open) {
        el.open = true
        el.scrollIntoView({ block: 'start' })
      }
    }
    open()
    window.addEventListener('hashchange', open)
    return () => window.removeEventListener('hashchange', open)
  }, [ids])
  return null
}
