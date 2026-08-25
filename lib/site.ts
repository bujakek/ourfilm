/**
 * The canonical origin, and the single source of the URL that ends up printed
 * on a QR card.
 *
 * Defaults to production rather than the current request's host on purpose. A
 * card generated while developing must still encode `https://ourfilm.app/e/…`; a
 * stack of cards pointing at `localhost` is a stack of waste paper, and the
 * mistake is invisible until someone scans one at the venue.
 *
 * Override with NEXT_PUBLIC_SITE_URL only to test a scan against a deploy
 * preview or a tunnel.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ourfilm.app'
).replace(/\/$/, '')

export function eventUrl(slug: string) {
  return `${SITE_URL}/e/${slug}`
}

/** Origin without the scheme, for places that show the URL rather than link it
 *  (the printed card, the landing page's mockups). */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '')

/**
 * PLACEHOLDER — the public contact address shown on /kapcsolat and in the
 * footer. Nothing verifies that this mailbox exists; confirm it (or replace it)
 * before the pages are indexed.
 */
export const CONTACT_EMAIL = 'hello@ourfilm.app'
