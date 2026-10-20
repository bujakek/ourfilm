/**
 * The host app's recurring treatments, as class strings in the manner of
 * `components/pages/layout.ts`. The tokens (`host-panel`, `host-tile`, …) are
 * in `app/globals.css`; the rules they follow are in DESIGN v5.
 */

/** Small tracked capitals above a heading. Keep it to one to three words. */
export const HOST_KICKER =
  'text-[11px] leading-[1.3] font-medium tracking-[0.24em] text-white/65 uppercase'

/** The live dot that may lead a kicker: `<span className={HOST_KICKER_DOT} />`
 *  inside a flex row with the kicker text. Sky, because it marks live state. */
export const HOST_KICKER_DOT =
  'inline-block size-1.5 shrink-0 rounded-full bg-landing-sky'

/** The event page's title. */
export const HOST_TITLE =
  'font-landing-display landing-serif text-[36px] leading-[1.15] text-white text-balance'

/** One onboarding question. */
export const HOST_QUESTION =
  'font-landing-display landing-serif text-[30px] leading-[1.2] text-white text-balance'

/** A grouping panel: no border, no hairlines. */
export const HOST_PANEL_SHAPE = 'rounded-[32px]'
export const HOST_PANEL = `${HOST_PANEL_SHAPE} bg-host-panel`

/** A tile or well inside a panel. */
export const HOST_TILE = 'rounded-[20px] bg-host-tile'

/** The one white action on a screen. */
export const HOST_PRIMARY =
  'inline-flex h-14 items-center justify-center rounded-[16px] bg-white px-6 text-[16px] font-medium text-landing-ink transition-colors hover:bg-white/90 disabled:opacity-40'

/** Everything that is not the one primary. */
export const HOST_SECONDARY =
  'inline-flex h-14 items-center justify-center rounded-[16px] bg-white/8 px-6 text-[16px] font-medium text-white transition-colors hover:bg-white/12 disabled:opacity-40'

/** Sky is for payment, and nothing else is allowed to wear it as a button. */
export const HOST_PAY =
  'inline-flex h-14 items-center justify-center rounded-[16px] bg-landing-sky px-6 text-[16px] font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-40'

/** 44px, the minimum tap target. */
export const HOST_ICON_BUTTON =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-host-tile text-white transition-colors hover:bg-white/10 disabled:opacity-40'

/** Text inputs and selects. */
export const HOST_FIELD =
  'h-14 w-full rounded-[16px] bg-host-tile px-4 text-[16px] text-white placeholder:text-white/55 outline-none focus-visible:ring-2 focus-visible:ring-white/40'
