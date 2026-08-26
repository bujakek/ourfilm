import Link from 'next/link'

import { defaultLocale } from '@/lib/i18n'
import { legalHref } from '@/lib/legal/routes'

/**
 * The two legal links a guest ever needs, pointing out of the product tree
 * into the marketing tree.
 *
 * `/e/` is deliberately not locale-prefixed — printed QR codes encode it — but
 * the documents are, so the locale has to be supplied here. `defaultLocale`
 * rather than a negotiated one: the guest UI is Hungarian-only today, and
 * guessing a language for a legal document is worse than serving the one that
 * exists.
 *
 * `target="_blank"` on purpose. A guest is standing in a room mid-party with a
 * half-finished acknowledgement on screen; navigating away from it to read a
 * notice and having to start again is how an acknowledgement stops being read.
 */
export function PrivacyNoticeLine({ text }: { text: string }) {
  const [before, after] = text.split('Adatkezelési tájékoztató')

  return (
    <p className="text-center text-xs leading-relaxed text-pretty text-muted-foreground">
      {before}
      <Link
        href={legalHref(defaultLocale, 'privacy')}
        target="_blank"
        rel="noopener"
        className="underline underline-offset-4"
      >
        Adatkezelési tájékoztató
      </Link>
      {after}
    </p>
  )
}

export function GuestTermsLink({ children }: { children: React.ReactNode }) {
  return (
    <Link
      href={legalHref(defaultLocale, 'guestTerms')}
      target="_blank"
      rel="noopener"
      className="underline underline-offset-4"
    >
      {children}
    </Link>
  )
}
