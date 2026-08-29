'use client'

import { X } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

const EXIT_MS = 180

export function Sheet({
  open,
  onClose,
  title,
  detail,
  icon,
  busy = false,
  children,
  closeLabel,
}: {
  open: boolean
  onClose?: () => void
  title: string
  detail?: string
  icon?: ReactNode
  busy?: boolean
  children: ReactNode
  closeLabel?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const closeTimer = useRef<number | null>(null)
  const titleId = useId()
  const reduceMotion = useReducedMotion()
  const [panelVisible, setPanelVisible] = useState(false)
  const dismissible = Boolean(closeLabel) && !busy

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }

    if (open) {
      if (!el.open) el.showModal()
      const frame = window.requestAnimationFrame(() => setPanelVisible(true))
      return () => window.cancelAnimationFrame(frame)
    }

    if (!el.open) return
    setPanelVisible(false)

    if (reduceMotion) {
      el.close()
      return
    }

    closeTimer.current = window.setTimeout(() => {
      el.close()
      closeTimer.current = null
    }, EXIT_MS)

    return () => {
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current)
        closeTimer.current = null
      }
    }
  }, [open, reduceMotion])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (dismissible) onClose?.()
      }}
      onClick={(event) => {
        if (event.target === ref.current && dismissible) onClose?.()
      }}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 text-foreground backdrop:bg-black/70"
    >
      <div className="pointer-events-none fixed inset-0 flex items-end justify-center sm:items-center sm:p-4">
        <motion.div
          initial={false}
          animate={
            panelVisible
              ? { opacity: 1, y: 0, scale: 1 }
              : reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 28, scale: 0.985 }
          }
          transition={
            reduceMotion
              ? { duration: 0 }
              : panelVisible
                ? { type: 'spring', stiffness: 430, damping: 36, mass: 0.8 }
                : { duration: EXIT_MS / 1000, ease: [0.4, 0, 1, 1] }
          }
          className="glass-overlay pointer-events-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-t-3xl sm:rounded-3xl"
        >
          <div className="p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6">
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                {icon ? <div className="mb-3">{icon}</div> : null}
                <h2
                  id={titleId}
                  className="font-display text-xl font-semibold tracking-tight text-balance"
                >
                  {title}
                </h2>
                {detail ? (
                  <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
                    {detail}
                  </p>
                ) : null}
              </div>
              {closeLabel ? (
                <motion.button
                  type="button"
                  onClick={onClose}
                  disabled={busy}
                  whileTap={
                    !busy && !reduceMotion ? { scale: 0.92 } : undefined
                  }
                  aria-label={closeLabel}
                  className="glass -mt-1 flex size-10 shrink-0 items-center justify-center rounded-[0.875rem] disabled:opacity-40"
                >
                  <X className="size-4" aria-hidden="true" />
                </motion.button>
              ) : null}
            </div>

            <div className="mt-5">{children}</div>
          </div>
        </motion.div>
      </div>
    </dialog>
  )
}
