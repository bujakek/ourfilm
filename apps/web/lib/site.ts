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

export function eventUrl(slug: string, locale?: 'en' | 'hu') {
  const url = `${SITE_URL}/e/${slug}`
  return locale ? `${url}?lang=${locale}` : url
}

/** Origin without the scheme, for places that show the URL rather than link it
 *  (the printed card, the landing page's mockups). */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '')

/**
 * The one inbound address. Shown on /kapcsolat, in the footer and on every
 * legal page, and it is where the contact form's copy, Early Couple
 * applications and replies to any mail we send all land — one mailbox, so a
 * host who replies to the address they were shown reaches the same place.
 * Outbound mail is `noreply@ourfilm.app` (`LEGAL_EMAIL_FROM`,
 * `AUTH_EMAIL_FROM`), which is a sender, not somewhere anyone reads.
 */
export const CONTACT_EMAIL = 'support@ourfilm.app'
