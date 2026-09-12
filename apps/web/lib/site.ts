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

/**
 * The guest camera the landing page offers as a demo.
 *
 * A real event someone keeps running, named here rather than in an
 * environment variable. It was an env var, and that bought a graceful
 * fallback nobody wanted: a hero whose second button silently became "how it
 * works" on every deploy where the variable had not been set — which is every
 * preview, and production until somebody remembered. A slug is not a secret;
 * it is printed on cards and pasted into chats, and `EXAMPLE_SLUG` already
 * sits in `lib/slug.ts` for the same reason.
 *
 * What the constant costs is that there is no degradation left. If this event
 * is deleted the button 404s, and nothing in the code can notice — the
 * homepage is prerendered, so checking would put a database round trip in
 * front of every landing. Keeping it alive is an operational habit, and
 * `pnpm grant` has already uncapped it so the participant limit cannot turn
 * visitors away on a link the hero offers them.
 */
export const DEMO_EVENT_SLUG = '5k6jj55jzn'

/**
 * Relative, unlike `eventUrl`. That helper is absolute because what it returns
 * gets printed onto a card that must not say `localhost`; this is a link
 * clicked from the page it is on, and staying on the current origin is what
 * makes it work on a preview and on a dev machine.
 */
export function demoEventUrl(locale: 'en' | 'hu'): string {
  return `/e/${DEMO_EVENT_SLUG}?lang=${locale}`
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

/** The public OurFilm profiles linked from the host account screen. */
export const INSTAGRAM_URL = 'https://www.instagram.com/ourfilm.app/'
export const TIKTOK_URL = 'https://www.tiktok.com/@ourfilm.app'
