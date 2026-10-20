'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'

import { initialToastState, TOAST_MS, toastReducer } from '@/lib/host-ui'
import { T, still } from '@/lib/motion'

type ToastAction = { label: string; onAction: () => void }

type HostToast = {
  show: (text: string, action?: ToastAction) => void
}

const ToastContext = createContext<HostToast | null>(null)

/** One toast at a time, at the bottom of the host screens. */
export function HostToastProvider({ children }: { children: ReactNode }) {
  const [{ toast }, dispatch] = useReducer(toastReducer, initialToastState)
  // The callback stays out of reducer state, which is pure data.
  const onAction = useRef<(() => void) | null>(null)
  const reduceMotion = useReducedMotion()

  const show = useCallback((text: string, action?: ToastAction) => {
    onAction.current = action?.onAction ?? null
    dispatch({
      type: 'show',
      text,
      action: action ? { label: action.label } : undefined,
    })
  }, [])

  const id = toast?.id
  useEffect(() => {
    if (id === undefined) return
    const timer = window.setTimeout(
      () => dispatch({ type: 'expire', id }),
      TOAST_MS,
    )
    return () => window.clearTimeout(timer)
  }, [id])

  const value = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4"
      >
        <AnimatePresence>
          {toast ? (
            <motion.div
              key={toast.id}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
              transition={reduceMotion ? still : T.settle}
              className="pointer-events-auto flex min-h-12 w-full max-w-md items-center gap-3 rounded-[16px] bg-host-sheet py-2 pr-2 pl-4 text-[15px] text-white shadow-host-sheet"
            >
              <span className="min-w-0 flex-1 text-pretty">{toast.text}</span>
              {toast.action ? (
                <button
                  type="button"
                  onClick={() => {
                    const run = onAction.current
                    onAction.current = null
                    dispatch({ type: 'dismiss' })
                    run?.()
                  }}
                  className="h-11 shrink-0 rounded-[12px] px-3 font-medium text-white underline underline-offset-4"
                >
                  {toast.action.label}
                </button>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useHostToast(): HostToast {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useHostToast needs a HostToastProvider')
  return value
}
