/** How long "✓ Mentve" stays after an autosave lands. */
export const SAVED_FLASH_MS = 1800

/** How long a host toast stays before it expires on its own. */
export const TOAST_MS = 4000

export type Toast = {
  id: number
  text: string
  action?: { label: string }
}

/** `nextId` only ever grows, so an id is never reused after a dismiss. */
export type ToastState = { toast: Toast | null; nextId: number }

export const initialToastState: ToastState = { toast: null, nextId: 1 }

export type ToastAction =
  | { type: 'show'; text: string; action?: { label: string } }
  | { type: 'dismiss' }
  | { type: 'expire'; id: number }

/**
 * One toast at a time: a new one replaces the old and takes the next id from a
 * counter that survives dismissal. The timer and the enter animation both key
 * on the id, and a timer that expires by id cannot clear a successor, even one
 * shown after a dismiss.
 */
export function toastReducer(
  state: ToastState,
  action: ToastAction,
): ToastState {
  switch (action.type) {
    case 'show':
      return {
        nextId: state.nextId + 1,
        toast: {
          id: state.nextId,
          text: action.text,
          ...(action.action ? { action: action.action } : {}),
        },
      }
    case 'dismiss':
      return { ...state, toast: null }
    case 'expire':
      return state.toast?.id === action.id ? { ...state, toast: null } : state
  }
}

/**
 * When the free cap deserves a banner on the event page: one seat from it, or
 * at it. Quiet otherwise, and always quiet on a paid or granted event.
 */
export function quotaBannerState({
  count,
  limit,
  unlimited,
}: {
  count: number
  limit: number
  unlimited: boolean
}): 'near' | 'full' | null {
  if (unlimited) return null
  if (count >= limit) return 'full'
  if (count === limit - 1) return 'near'
  return null
}
