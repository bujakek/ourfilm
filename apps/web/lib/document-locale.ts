import { isLocale } from './i18n'

/**
 * What `proxy.ts` tells the product root layout about a request, so
 * `<html lang>` can say the language the page below is about to render.
 *
 * A root layout receives neither the pathname nor `searchParams`, and the
 * product routes have no locale segment, so without this it could only
 * declare the site default — English on every Hungarian screen. The proxy
 * sees the URL and passes on just enough for the layout to repeat each page's
 * own decision:
 *
 * - `guest` (`/e/…`): the visitor's saved choice, then `Accept-Language`,
 *   exactly as `app/(product)/e/[slug]/page.tsx` decides it.
 * - `host` (`/host/…`, `/auth/…`): `getHostLocale` with the validated `?lang`
 *   as its fallback, which is what the host pages ask.
 *
 * Both headers are overwritten on every matched request, so nothing a browser
 * sends under these names survives. It decides one attribute and nothing
 * else; every page still marks its own subtree with `lang`.
 */
export const DOCUMENT_ROUTE_HEADER = 'x-ourfilm-document-route'
export const DOCUMENT_LANG_HEADER = 'x-ourfilm-document-lang'

export type DocumentRoute = 'guest' | 'host'

export function documentRouteFor(pathname: string): DocumentRoute | null {
  if (pathname.startsWith('/e/')) return 'guest'
  if (
    pathname === '/host' ||
    pathname.startsWith('/host/') ||
    pathname.startsWith('/auth/')
  ) {
    return 'host'
  }
  return null
}

/** Marks a request for the product layout; see the module comment. */
export function markDocumentLocale(
  headers: Headers,
  pathname: string,
  lang: string | null,
): void {
  headers.delete(DOCUMENT_ROUTE_HEADER)
  headers.delete(DOCUMENT_LANG_HEADER)
  const route = documentRouteFor(pathname)
  if (!route) return
  headers.set(DOCUMENT_ROUTE_HEADER, route)
  if (route === 'host' && lang && isLocale(lang)) {
    headers.set(DOCUMENT_LANG_HEADER, lang)
  }
}
