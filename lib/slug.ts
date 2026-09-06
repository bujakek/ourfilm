/**
 * Event slugs are opaque codes. Nothing readable is derived from the event
 * name any more, and that is the whole point of this file.
 *
 * A name-shaped stem (`anna-peter-k3f9x7`) was three things at once: the
 * album's address, a label, and a promise that the two agree. Renaming an
 * event broke the third — the stem is minted once and then printed onto QR
 * cards, so a host who fixes a typo now has a link that says the old name for
 * ever. A code says nothing, so it can never say the wrong thing. It also
 * keeps the couple's names out of a URL that gets forwarded, screenshotted and
 * pasted into group chats.
 */

/**
 * Digits and lowercase letters with every visually confusable character
 * removed — no `0`/`o`, no `1`/`l`/`i`, and no `u` (it turns innocent random
 * strings into words nobody wants printed on a wedding invitation). Guests
 * retype these off a card in dim light, so a misread has to be impossible
 * rather than merely unlikely.
 */
const SLUG_ALPHABET = '23456789abcdefghjkmnpqrstvwxyz'

/**
 * 30^10 ≈ 5.9e14. It was six characters while a readable stem sat in front of
 * it, and that stem was carrying more of the guess than it looked: an attacker
 * had to produce a plausible name *and* the suffix. With the name gone the
 * code is the entire lock on the album, so it grew to stand alone.
 */
const SLUG_LENGTH = 10

/**
 * Cryptographically random, with rejection sampling so the modulo does not
 * skew the distribution. `Math.random()` would be wrong here: this code *is*
 * the access control for the album, not a cosmetic id.
 */
function randomCode(length: number = SLUG_LENGTH) {
  // Largest multiple of the alphabet size that fits in a byte; anything at or
  // above it is discarded so every character stays equally likely.
  const ceiling = Math.floor(256 / SLUG_ALPHABET.length) * SLUG_ALPHABET.length
  const out: string[] = []
  const buffer = new Uint8Array(length * 2)

  while (out.length < length) {
    crypto.getRandomValues(buffer)
    for (const byte of buffer) {
      if (out.length === length) break
      if (byte >= ceiling) continue
      out.push(SLUG_ALPHABET[byte % SLUG_ALPHABET.length])
    }
  }

  return out.join('')
}

/**
 * The slug a real event gets. Guests reach the album with no login, no
 * passcode and no gate of any kind, so the URL is the only thing standing
 * between a wedding album and anyone who fancies guessing at it.
 *
 * Takes no arguments on purpose: there is no input a caller could pass that
 * should influence the address.
 */
export function generateEventSlug() {
  return randomCode()
}

/**
 * Fixed stand-in for the marketing site's previews. It must be the same
 * *shape* a host is really given — a mockup that shows a name in the URL
 * teaches hosts to expect a link that does not exist, and events created
 * before September 2026 already carry name-shaped slugs without anyone
 * needing to be shown one.
 */
export const EXAMPLE_SLUG = 'k3f9x7ab2m'
