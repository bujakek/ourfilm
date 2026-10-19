'use client'

import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'

import { T, still } from '@/lib/motion'

/**
 * A menu that overlays the page without moving it. The panel is absolute under
 * its relatively positioned parent; a transparent full-screen button behind it
 * catches the tap-away. Escape closes, and focus goes back to the trigger.
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
  const trigger = useRef<Element | null>(null)

  useEffect(() => {
    if (!open) return
    trigger.current = document.activeElement
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const opener = trigger.current
    return () => {
      document.removeEventListener('keydown', onKey)
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [open, onClose])

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
