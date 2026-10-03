/**
 * The homepage's one column. 20px gutters on a phone; on a desktop the
 * design's 5% margin, stopping at 72px so a wide screen centres a 1296px page
 * rather than stretching it.
 */
export const LANDING_CONTAINER =
  'mx-auto w-full max-w-[1440px] px-5 lg:px-[min(5vw,72px)]'

/** Small wide-set capitals: eyebrows, step numbers, the counting row. */
export const LANDING_EYEBROW =
  'text-[13px] font-medium tracking-[0.24em] uppercase lg:text-[14px]'

/** Section headings in the display serif. Sizes are the caller's: a size
 *  merged in after a `leading-*` makes tailwind-merge drop the leading. */
export const LANDING_H2 = 'font-landing-display landing-serif text-white'

export const LANDING_H2_SIZE =
  'text-[26px] leading-[1.2] lg:text-[42px] lg:leading-[1.2]'
