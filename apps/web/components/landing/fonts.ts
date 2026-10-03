import { Crimson_Text, Inter, Roboto_Serif } from 'next/font/google'

/**
 * The homepage's three faces, loaded by the homepage alone.
 *
 * The approved landing design was set in Rosemartin and Pretendard. Neither
 * ships here: Rosemartin is a commercial face with no licence for this site,
 * and its file has no Hungarian accents — `szemével` set in it falls back
 * mid-word. The replacements are chosen to hold the same measure:
 *
 * - **Roboto Serif at `wdth` 125, weight 300** for the display lines. Of the
 *   open serifs with `ő` and `ű` it is the one wide enough to keep the
 *   design's line breaks — `A ti napotok,` still ends the first hero line.
 * - **Inter** for everything set in Pretendard. Pretendard's Latin *is*
 *   Inter, so nothing moves.
 * - **Crimson Text** is the design's own face for the review titles and the
 *   counting row, and it is already open.
 *
 * Scoped to the landing rather than added to `lib/document.ts`: every other
 * surface stays on Manrope and Instrument Serif, and this keeps three more font
 * files off the guest page a QR code opens.
 */
const landingDisplay = Roboto_Serif({
  subsets: ['latin', 'latin-ext'],
  weight: 'variable',
  axes: ['wdth', 'opsz'],
  variable: '--font-roboto-serif',
  display: 'swap',
})

const landingSans = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
})

const landingQuote = Crimson_Text({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-crimson-text',
  display: 'swap',
})

/** Goes on the landing's outermost element; the utilities in `globals.css`
 *  (`font-landing-*`) read these variables. */
export const landingFontClass = `${landingDisplay.variable} ${landingSans.variable} ${landingQuote.variable}`
