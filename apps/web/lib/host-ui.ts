/** How long "✓ Mentve" stays after an autosave lands. */
export const SAVED_FLASH_MS = 1800

/** How long a host toast stays before it expires on its own. */
export const TOAST_MS = 4000

export type ToastState = {
  id: number
  text: string
  action?: { label: string }
} | null

export type ToastAction =
  | { type: 'show'; text: string; action?: { label: string } }
  | { type: 'dismiss' }
  | { type: 'expire'; id: number }

/**
 * One toast at a time: a new one replaces the old and bumps the id, so the
 * old one's timer — which expires by id — cannot clear its successor.
 */
export function toastReducer(
  state: ToastState,
  action: ToastAction,
): ToastState {
  switch (action.type) {
    case 'show':
      return {
        id: (state?.id ?? 0) + 1,
        text: action.text,
        ...(action.action ? { action: action.action } : {}),
      }
    case 'dismiss':
      return null
    case 'expire':
      return state && state.id === action.id ? null : state
  }
}
