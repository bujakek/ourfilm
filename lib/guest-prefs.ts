import 'client-only'

/**
 * Per-device guest preferences. Nothing here gates anything.
 *
 * All that survives of the old `lib/guest-name.ts` is this one flag. The name
 * and the "has uploaded here" marker moved into the database as a participant,
 * because they gate a shot limit and a value the page can write is a value the
 * page can forge. A dismissed upsell gates nothing, so localStorage is exactly
 * the right place for it — and the right blast radius when it is unavailable.
 */

const UPSELL_DISMISSED_KEY = 'ourfilm:upsell-dismissed'

/** Every accessor swallows. Safari in private mode throws on localStorage, and
 *  an upsell is not worth a blank screen. */
export function upsellDismissed(): boolean {
  try {
    return localStorage.getItem(UPSELL_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissUpsell() {
  try {
    localStorage.setItem(UPSELL_DISMISSED_KEY, '1')
  } catch {
    // A guest who cannot persist the dismissal sees it again next time. That
    // is a smaller problem than a thrown error on a gallery page.
  }
}
