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
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

import {
  initialToastState,
  toastExpiry,
  toastReducer,
  type ToastHold,
} from '@/lib/host-ui'
import { T, still } from '@/lib/motion'

import { HOST_FOCUS } from './classes'

type ToastAction = { label: string; onAction: () => void }

type HostToast = {
  show: (text: string, action?: ToastAction) => void
}

const ToastContext = createContext<HostToast | null>(null)

/** Registers an element the toast region should render inside; returns the
 *  unregister. */
type ToastLayers = { register: (element: HTMLElement) => () => void }

const LayerContext = createContext<ToastLayers | null>(null)

/**
 * Lends the toast region to a modal `<dialog>` while it is open.
 *
 * `showModal()` puts the dialog in the top layer and makes the rest of the
 * document inert, so a toast drawn at the end of the body sits underneath it
 * and cannot be tapped — the undo after a hide in the photo viewer was exactly
 * that. A registered element becomes the region's portal container; the most
 * recent one wins, so a modal opened over another takes it, and the region
 * goes back to its place in the tree when the last one leaves.
 *
 * A layer that keeps controls at the bottom sets `--host-toast-offset` on
 * itself, and the region, inheriting it, rises clear of them.
 *
 * A no-op outside a `HostToastProvider`, so a component shared with the guest
 * side can call it unconditionally.
 */
export function useToastLayer(
  ref: RefObject<HTMLElement | null>,
  active = true,
) {
  const layers = useContext(LayerContext)
  useEffect(() => {
    const element = ref.current
    if (!layers || !element || !active) return
    return layers.register(element)
  }, [layers, ref, active])
}

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

  // A pointer over the toast or focus inside it holds it open; see
  // `toastExpiry`. Keyed by id, so a hold dies with the toast it was on.
  const [hold, setHold] = useState<ToastHold | null>(null)
  const holdBy = useCallback(
    (id: number, by: 'pointer' | 'focus', on: boolean) =>
      setHold((current) => ({
        ...(current?.id === id
          ? current
          : { id, pointer: false, focus: false }),
        [by]: on,
      })),
    [],
  )

  const id = toast?.id
  const expiresIn = toastExpiry(toast, hold)
  useEffect(() => {
    if (id === undefined || expiresIn === null) return
    const timer = window.setTimeout(
      () => dispatch({ type: 'expire', id }),
      expiresIn,
    )
    return () => window.clearTimeout(timer)
  }, [id, expiresIn])

  const value = useMemo(() => ({ show }), [show])

  const [layers, setLayers] = useState<HTMLElement[]>([])
  const register = useCallback((element: HTMLElement) => {
    setLayers((current) => [...current, element])
    return () =>
      setLayers((current) => current.filter((layer) => layer !== element))
  }, [])
  const layerValue = useMemo(() => ({ register }), [register])
  const layer = layers.at(-1) ?? null

  const region = (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--host-toast-offset,1rem)+env(safe-area-inset-bottom))] z-50 flex justify-center px-4"
    >
      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast.id}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            transition={reduceMotion ? still : T.settle}
            onPointerEnter={() => holdBy(toast.id, 'pointer', true)}
            onPointerLeave={() => holdBy(toast.id, 'pointer', false)}
            onFocus={() => holdBy(toast.id, 'focus', true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                holdBy(toast.id, 'focus', false)
            }}
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
                className={`h-11 shrink-0 rounded-[12px] px-3 font-medium text-white underline underline-offset-4 ${HOST_FOCUS}`}
              >
                {toast.action.label}
              </button>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )

  return (
    <ToastContext.Provider value={value}>
      <LayerContext.Provider value={layerValue}>
        {children}
        {/* Inline unless a modal has lent its element, so the server render
            and every screen without one are unchanged. */}
        {layer ? createPortal(region, layer) : region}
      </LayerContext.Provider>
    </ToastContext.Provider>
  )
}

export function useHostToast(): HostToast {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useHostToast needs a HostToastProvider')
  return value
}
