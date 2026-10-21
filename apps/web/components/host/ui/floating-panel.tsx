'use client'

import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'

import { T, still } from '@/lib/motion'

/**
 * A menu that overlays the page without moving it. The panel is absolute under
 * its relatively positioned parent; a transparent full-screen button behind it
 * catches the tap-away. On open, focus moves to the element inside marked
 * `data-initial-focus`, if there is one (the calendar marks its selected day);
 * Escape closes, and focus goes back to the trigger.
 */
export function FloatingPanel({
  open,
  onClose,
  anchorClassName,
  children,
}: {
  open: boolean
  onClose: () => void
  /** Where the panel sits relative to the trigger, e.g. `right-0 top-full mt-2`. */
  anchorClassName: string
  children: ReactNode
}) {
  const reduceMotion = useReducedMotion()
  // An inline `onClose` is a new function every render; depending on it would
  // run the cleanup (and its focus return) on every parent render.
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    // Read before focus moves inside, so the close can hand it back.
    const opener = document.activeElement
    panel.current
      ?.querySelector<HTMLElement>('[data-initial-focus]')
      ?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default bg-transparent"
      />
      <motion.div
        ref={panel}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? still : T.settle}
        className={`absolute z-50 rounded-[20px] bg-host-sheet p-2 text-white shadow-host-sheet ${anchorClassName}`}
      >
        {children}
      </motion.div>
    </>
  )
}
