/**
 * The pages around the homepage share one column and a handful of type
 * treatments. Kept as class strings, like `components/landing/layout.ts`, so
 * a page reads as markup rather than as a wrapper component per heading.
 *
 * `tab:` is the 810px breakpoint the approved designs switch at.
 */

/** 90% wide, never wider than 1300px. */
export const SITE_CONTAINER = 'mx-auto w-[90%] max-w-[1300px]'

/** Small grey capitals above a heading. */
export const SITE_KICKER =
  'text-[12px] leading-[1.3] font-medium tracking-[0.24em] text-site-kicker uppercase tab:text-[14px] tab:leading-[1.2]'

/** Page and section headings: the display serif at 34px, 46px from 810px. */
export const SITE_HEADING =
  'font-landing-display landing-serif text-[34px] leading-[1.2] text-white tab:text-[46px]'

/** Body copy under a heading. */
export const SITE_LEAD =
  'text-[16px] leading-[1.6] text-site-muted tab:text-[18px]'

/** The white call to action every page ends on. */
export const SITE_BUTTON =
  'inline-flex h-[50px] min-w-[190px] items-center justify-center rounded-[16px] bg-white px-5 text-[15px] font-medium whitespace-nowrap text-landing-ink transition-colors hover:bg-white/90 tab:h-11'
