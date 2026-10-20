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

/** Who is holding a toast open: a pointer over it, or focus inside it. Keyed
 *  by the toast's id, so a hold never carries over to the toast that
 *  replaces it. */
export type ToastHold = { id: number; pointer: boolean; focus: boolean }

/**
 * How long the current toast has left, or `null` when nothing should expire
 * it. A held toast waits (WCAG 2.2.1): an undo must not vanish from under the
 * finger or the keyboard reaching for it. Letting go starts a full timer again
 * rather than the remainder, so the text can still be read after the hand
 * moves away.
 */
export function toastExpiry(
  toast: Toast | null,
  hold: ToastHold | null,
): number | null {
  if (!toast) return null
  if (hold?.id === toast.id && (hold.pointer || hold.focus)) return null
  return TOAST_MS
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
 * What the capture-end field shows after a failed save (7e). A failed end is
 * never left on screen as if it were the answer: the field goes back to the
 * stored value. When the refusal was an end before the event began, it is
 * also outlined and the line under it names that value; any other failure is
 * the header's "Újra" toast. A landed save leaves the field alone, because
 * the host may already be typing the next value. Capture end is deliberately
 * not optimistic, so this is the whole of its fallback.
 */
export function captureEndDisplay(
  stored: string,
  beforeStart: boolean,
): { value: string; error: boolean } {
  return { value: stored, error: beforeStart }
}

/**
 * What a committed capture end does (1). All three strings are
 * `datetime-local` wall clock in the event's own zone, so they compare as
 * text, and `now` is passed in like every other clock here.
 *
 * - `refuse`: at or before the start — the server's own rule (7e), applied
 *   before the round trip.
 * - `hold`: a picked *day* that, against the time already in the field,
 *   would close a camera that is still open. The day joins whatever time was
 *   there, and closing guests out of a running party is not something to do
 *   on half a choice: the value stays in the fields, unsent, until a time is
 *   committed.
 * - `save`: everything else, including a past end committed from the time
 *   field. By then the host has chosen both parts, and an end already past is
 *   how a camera is stopped early.
 */
export function captureEndCommit({
  stored,
  next,
  start,
  now,
  source,
}: {
  stored: string
  next: string
  start: string
  now: string
  /** Which part the host just committed. */
  source: 'day' | 'time'
}): 'save' | 'hold' | 'refuse' {
  if (next <= start) return 'refuse'
  if (source === 'day' && next <= now && stored > now) return 'hold'
  return 'save'
}

/**
 * The bookkeeping behind an autosaving field whose saves can overlap and
 * answer out of order. `issued` numbers each save; `confirmed` is the newest
 * one the server accepted, so an overtaken save that landed still moves
 * `stored` while an older one landing late cannot undo a newer; `inFlight` is
 * the value of the latest save still waiting, so a second commit of it is not
 * sent twice.
 */
export type SaveLedger = {
  issued: number
  confirmed: number
  inFlight: string | null
  stored: string
}

export function saveLedger(stored: string): SaveLedger {
  return { issued: 0, confirmed: 0, inFlight: null, stored }
}

/**
 * Whether a committed value needs a save. The stored value committed while
 * another save is in flight is a change — that save is about to replace it —
 * so only an idle ledger calls it `unchanged`.
 */
export function saveLedgerCommit(
  ledger: SaveLedger,
  next: string,
): 'skip' | 'unchanged' | 'send' {
  if (next === ledger.inFlight) return 'skip'
  if (next === ledger.stored && ledger.inFlight === null) return 'unchanged'
  return 'send'
}

export function saveLedgerIssue(
  ledger: SaveLedger,
  next: string,
): { ledger: SaveLedger; seq: number } {
  const seq = ledger.issued + 1
  return { ledger: { ...ledger, issued: seq, inFlight: next }, seq }
}

/** A save answered. Only the `latest` one may touch the field or report. */
export function saveLedgerSettle(
  ledger: SaveLedger,
  seq: number,
  value: string,
  ok: boolean,
): { ledger: SaveLedger; latest: boolean } {
  const latest = seq === ledger.issued
  let next = ledger
  if (ok && seq > ledger.confirmed) {
    next = { ...next, confirmed: seq, stored: value }
  }
  if (latest) next = { ...next, inFlight: null }
  return { ledger: next, latest }
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
