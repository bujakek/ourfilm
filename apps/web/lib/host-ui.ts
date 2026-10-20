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

export type AutosaveResult = 'ok' | 'error'

/**
 * What an autosaving setting does once its action answers. A landed save
 * flashes "✓ Mentve" in the header; a failed one shows no flash, puts the
 * control back where the server still has it and offers "Újra" in a toast.
 * The 7d state, as data, so every control on the screen answers the same way.
 */
export function autosaveOutcome(result: AutosaveResult): {
  flashSaved: boolean
  revert: boolean
  toast: 'retry' | null
} {
  return result === 'ok'
    ? { flashSaved: true, revert: false, toast: null }
    : { flashSaved: false, revert: true, toast: 'retry' }
}

/**
 * What the capture-end field shows after a save attempt (7e). A refused end
 * is never left on screen as if it were the answer: the field goes back to
 * the stored value, outlined, and the line under it names that value. Capture
 * end is deliberately not optimistic, so this is the whole of its fallback.
 */
export function captureEndDisplay(
  stored: string,
  attempted: string,
  refused: boolean,
): { value: string; error: boolean } {
  return refused
    ? { value: stored, error: true }
    : { value: attempted, error: false }
}

/** How long the "send a new link" button waits after a link goes out. */
export const RESEND_COOLDOWN_S = 60

/** Whole seconds until another sign-in link may be requested, between 0 and
 *  the cooldown, so a clock stepping backwards cannot lengthen the wait. */
export function resendSecondsLeft(sentAt: number, now: number): number {
  const left = RESEND_COOLDOWN_S - Math.floor((now - sentAt) / 1000)
  return Math.min(RESEND_COOLDOWN_S, Math.max(0, left))
}

/**
 * How long a sign-in link works, as the screen states it. Pinned by a test to
 * `[auth.email] otp_expiry` in `supabase/config.toml`; the hosted project's
 * own setting is in the dashboard and has to be kept equal by hand.
 */
export const SIGN_IN_LINK_TTL_MINUTES = 60

/**
 * The Hungarian definite article before a numeral, which follows how the
 * number is read aloud: `az` before egy, öt, ötven, ötszáz, ezer and
 * egymillió, `a` before everything else. Only the leading spoken word
 * matters, so only the leading three-digit group is read.
 */
export function huNumberArticle(n: number): 'a' | 'az' {
  let group = Math.floor(Math.abs(n))
  let scale = 0
  while (group >= 1000) {
    group = Math.floor(group / 1000)
    scale += 1
  }
  // 1000 is "ezer" and 1 000 000 is "egymillió": both open on a vowel.
  if (group === 1 && scale > 0) return 'az'
  const lead =
    group >= 100
      ? Math.floor(group / 100) // száz, kétszáz, … ötszáz
      : group >= 10
        ? Math.floor(group / 10) // tíz, húsz, … ötven
        : group // nulla, egy, … öt
  if (group >= 10) return lead === 5 ? 'az' : 'a'
  return lead === 1 || lead === 5 ? 'az' : 'a'
}

/**
 * The 7f notice on the billing card. A latest purchase that failed says so on
 * any visit, since the webhook is what learned it; a `?checkout=cancelled`
 * return says the payment did not finish, unless the event is paid by now, in
 * which case the URL is stale and the card's paid state is the whole answer.
 * Hosted Checkout never tells us why a payment failed, so neither does this.
 */
export function paymentNotice(
  purchase: { status: string } | null,
  cancelledReturn: boolean,
): 'failed' | 'cancelled' | null {
  if (purchase?.status === 'failed') return 'failed'
  if (cancelledReturn && purchase?.status !== 'paid') return 'cancelled'
  return null
}
