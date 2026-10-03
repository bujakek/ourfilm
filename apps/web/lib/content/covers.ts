import type { Locale } from '@/lib/i18n'

/**
 * The photograph on each article's card and at the top of the article.
 *
 * Presentation only, which is why it is not the `image` frontmatter field:
 * that one becomes the Open Graph image, and crawlers want a JPEG there, not
 * these WebP photographs. Keyed by document **id**, so an article and its
 * translation share a cover. An article missing here — a new one — falls back
 * to a photograph picked from its id, so it is never shown without one.
 */
const COVERS: Record<string, string> = {
  'best-apps-collect-wedding-photos': 'how-guest-photo',
  'best-wedding-photo-sharing-apps': 'wedding-dance',
  'best-wedding-qr-photo-albums': 'guests-laughing',
  'digital-disposable-vs-qr': 'hero-dance-crowd',
  'disposable-camera-alternatives': 'guests-laughing',
  'disposable-camera-app': 'wedding-dance',
  'dropbox-wedding-photo-sharing': 'evening-party',
  'filmic-wedding-guest-photos': 'reveal-bride-friends',
  'google-drive-wedding-upload': 'wedding-dance',
  'google-photos-wedding-guests': 'hero-dance-crowd',
  'guest-upload-participation': 'wedding-dance',
  'icloud-shared-album-wedding': 'reveal-bride-friends',
  'international-wedding-photo-sharing': 'how-guest-photo',
  'live-photo-wall-wedding': 'reveal-bride-friends',
  'original-quality-wedding-photos': 'hero-dance-crowd',
  'photo-sharing-comparison': 'guests-laughing',
  'qr-code-placement': 'qr-table-card-hu',
  'qr-code-sign-text': 'qr-table-card-hu',
  'shared-album-vs-photo-app': 'evening-party',
  'unique-wedding-ideas': 'guests-laughing',
  'wedding-audio-guestbook': 'evening-party',
  'wedding-entertainment-ideas': 'evening-party',
  'wedding-guest-activities': 'wedding-dance',
  'wedding-guest-photo-ideas': 'how-guest-photo',
  'wedding-hashtag-vs-qr': 'hero-dance-crowd',
  'wedding-memory-ideas': 'how-guest-photo',
  'wedding-photo-backup': 'how-guest-photo',
  'wedding-photo-booth-alternatives': 'hero-sunglasses-couple',
  'wedding-photo-corner-ideas': 'reveal-bride-friends',
  'wedding-photo-guestbook': 'reveal-couple-toast',
  'wedding-photo-organization': 'evening-party',
  'wedding-photo-privacy': 'reveal-bride-friends',
  'wedding-photo-request-timing': 'guests-laughing',
  'wedding-photo-scavenger-hunt': 'reveal-limbo',
  'wedding-photo-sharing': 'evening-party',
  'wedding-photo-sharing-checklist': 'hero-couple-dance',
  'wedding-photo-thank-you-message': 'reveal-bride-friends',
  'wedding-qr-code-guide': 'qr-table-card-hu',
  'wedding-qr-sign-ideas': 'qr-table-card-hu',
  'wedding-wifi-photo-upload': 'reveal-bride-friends',
  'whatsapp-wedding-photo-sharing': 'hero-dance-crowd',
}

/** Photographs that live directly in `/images`; the rest are in `/images/landing`. */
const ROOT = new Set([
  'birthday',
  'evening-party',
  'guests-laughing',
  'wedding-dance',
])

const FALLBACK = [
  'evening-party',
  'guests-laughing',
  'wedding-dance',
  'hero-dance-crowd',
]

export function coverFor(id: string, locale: Locale): string {
  let name =
    COVERS[id] ??
    FALLBACK[
      [...id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % FALLBACK.length
    ]
  // The table card is printed in the reader's language.
  if (name === 'qr-table-card-hu') name = `qr-table-card-${locale}`
  return ROOT.has(name)
    ? `/images/${name}.webp`
    : `/images/landing/${name}.webp`
}
