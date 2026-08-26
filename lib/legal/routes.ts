import { type Locale, localePath } from '@/lib/i18n'

/**
 * The legal routes, named once.
 *
 * Six documents and two forms cross-reference each other constantly — the
 * ÁSZF points at the withdrawal page, the guest terms point at the report
 * form, the footer points at all of them — and a legal document containing a
 * dead link is a worse defect than an ordinary broken link, because it is the
 * route someone reaches for when something has already gone wrong.
 *
 * Locale-relative, like everything under `app/[locale]`. Use `legalHref()` to
 * prefix.
 */
export const LEGAL_PATHS = {
  imprint: '/impresszum',
  terms: '/aszf',
  privacy: '/adatvedelem',
  guestTerms: '/vendegfeltetelek',
  processing: '/adatfeldolgozasi-melleklet',
  withdrawal: '/elallas',
  report: '/jogserto-tartalom-bejelentese',
} as const

export type LegalRoute = keyof typeof LEGAL_PATHS

export function legalHref(locale: Locale, route: LegalRoute): string {
  return localePath(locale, LEGAL_PATHS[route])
}

/**
 * The documents that are pure information, and are therefore indexable once
 * the provider's details are real.
 *
 * The two form routes are excluded on purpose: they are transactional, they
 * carry no content worth ranking, and one of them is a complaint intake.
 */
export const INDEXABLE_LEGAL_ROUTES: LegalRoute[] = [
  'imprint',
  'terms',
  'privacy',
  'guestTerms',
  'processing',
]
