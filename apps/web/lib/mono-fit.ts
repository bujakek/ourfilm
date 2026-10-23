/**
 * A font size that fits a Martian Mono string into its container, capped at
 * the size the design asks for.
 *
 * The host console's figures are three equal columns, and a number in one of
 * them used to be set at a fixed 30px. Martian Mono is wide — every glyph
 * advances 0.75em — so on a 320px phone a third of the row holds barely two
 * and a half digits. "100" guests rendered as "10", "1000" photos lost its
 * last digit, and the free tier's "5/5" lost the edge of its first: the
 * numeral sits in a flex row with `overflow: hidden`, which lets it shrink
 * below its own content and clip rather than push anything aside.
 *
 * Because the face is monospaced the fit is arithmetic rather than a
 * measurement: a string of `n` characters at `s` px is `n × advance × s` wide,
 * so the largest size that fits is the container's width divided by
 * `n × advance`. That is a pure CSS expression — `cqi` is 1% of the nearest
 * inline-size container's content box — so it is right on the first paint,
 * needs no effect, and follows the cell when the viewport rotates.
 *
 * The element this goes on needs an ancestor with `container-type:
 * inline-size` (Tailwind's `@container`) whose content box is the space the
 * string may use.
 */

/** Martian Mono's advance width in em. Every glyph, digits and slash alike. */
export const MONO_ADVANCE_EM = 0.75

export function fittedMonoSize({
  text,
  maxPx,
  trackingEm = 0,
}: {
  /** Exactly what is drawn, so a `/cap` suffix counts too. */
  text: string
  /** The design size; the result is never larger. */
  maxPx: number
  /** The element's letter-spacing in em, applied after every glyph. */
  trackingEm?: number
}): string {
  const em = Math.max(1, text.length) * (MONO_ADVANCE_EM + trackingEm)
  return `min(${maxPx}px, calc(100cqi / ${Number(em.toFixed(4))}))`
}
