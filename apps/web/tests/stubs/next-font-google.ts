/**
 * `next/font/google` for tests.
 *
 * The real module is a compile-time transform: Next replaces each call with
 * the generated font during the build, and outside one the exports are not
 * functions at all. Page modules now import the homepage's fonts through
 * `components/pages/site-shell.tsx`, and tests import those modules for their
 * `generateMetadata` — so every font here is an empty class and variable.
 */
const font = () => ({ className: '', variable: '', style: {} })

export const Crimson_Text = font
export const Inter = font
export const Instrument_Serif = font
export const Manrope = font
export const Martian_Mono = font
export const Roboto_Serif = font
