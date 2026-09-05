import { isLocale } from '@/lib/i18n'
import { publicSupabaseEnv } from '@/lib/supabase/env'
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Auth gate for the admin area, and the trailing-slash redirect Next no longer
 * does on its own.
 *
 * Next 16 renamed middleware: this file must be `proxy.ts` and the handler must
 * be `proxy`. A `middleware.ts` here would be silently ignored — no warning, no
 * error — leaving /host open while looking guarded in the source tree.
 *
 * The matcher export is still `config`, **not** `proxyConfig`. Getting that
 * wrong is worse than it sounds: the matcher is ignored and the proxy runs on
 * every request, so an unauthenticated visitor is redirected to the login page
 * from the marketing homepage, the guest event pages and robots.txt alike.
 * Silently, again. Verify by requesting `/` signed out — it must return 200.
 *
 * `PUBLIC_ADMIN_PATHS` is the one hole in the gate, and it is deliberate: the
 * create flow is filled in *before* anyone has an account. Nothing behind it
 * reads or writes a row — it is a form that keeps its answers in
 * `localStorage` and asks for an account at the end, when there is finally
 * something to save. Every route that touches data stays gated, including the
 * one that finishes the creation.
 */

/**
 * Admin paths a signed-out visitor may open, matched exactly.
 *
 * Exact equality, never `startsWith`. A prefix here would open every child of
 * the path as well, and `/host/events/new` is one segment away from routes
 * that list and mutate real events.
 *
 * The screen that finishes the creation after signing up is deliberately **not**
 * here: it lives at `/auth/event-complete`, outside this matcher entirely. A
 * Server Action posts to the path of the page that owns it, so an `/host/**`
 * path would mean this gate answering `createEventFromDraft`'s own POST with a
 * redirect and discarding the call. Its own page comment has the rest.
 */
const PUBLIC_ADMIN_PATHS = new Set(['/host/events/new'])

/**
 * The one prefix that keeps its trailing slash.
 *
 * `next.config.mjs` sets `skipTrailingSlashRedirect` so PostHog's `/ingest/e/`
 * POSTs reach the rewrite instead of a 308. That switch is global, so the
 * redirect every other URL used to get from Next — `/hu/arak/` → `/hu/arak` —
 * is issued here instead, with the same status. The matcher's second entry is
 * what brings those requests through this file at all.
 */
const KEEPS_TRAILING_SLASH = '/ingest/'

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname

  if (
    path.length > 1 &&
    path.endsWith('/') &&
    !path.startsWith(KEEPS_TRAILING_SLASH)
  ) {
    // A plain `URL`, not `nextUrl.clone()`: `NextURL` remembers that the
    // request came in with a trailing slash and puts it back when it formats
    // itself, whatever `pathname` was set to — which turned this into a
    // redirect to the very same URL. Verified with `curl -I /hu/arak/`.
    const target = new URL(request.url)
    target.pathname = path.replace(/\/+$/, '')
    return NextResponse.redirect(target, 308)
  }

  // Everything below is the host gate. The trailing-slash matcher also brings
  // marketing and guest URLs here, and those must pass through untouched — an
  // auth check on `/hu/` would be the exact failure the matcher note above
  // warns about.
  if (!path.startsWith('/host')) return NextResponse.next()

  const { url, anonKey } = publicSupabaseEnv()

  // Rebuilt whenever Supabase rotates cookies, so a refreshed session is
  // actually carried back to the browser.
  let response = NextResponse.next({ request })

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, cacheHeaders) => {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        )
        response = NextResponse.next({ request })
        Object.entries(cacheHeaders).forEach(([name, value]) =>
          response.headers.set(name, value),
        )
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  // getUser(), never getSession(). getSession() reads the cookie without
  // verifying it, so it will happily report a user for a forged one — fine for
  // deciding what to render, useless for deciding who gets in.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLoginRoute = path.startsWith('/host/login')
  const isPublicRoute = PUBLIC_ADMIN_PATHS.has(path)

  if (!user && !isLoginRoute && !isPublicRoute) {
    return redirectWithin(request, '/host/login')
  }

  // A signed-in host opening the login page is bounced to their events. The
  // public create flow is not: it works the same either way, and the only
  // difference is that they are not asked for an account at the end.
  if (user && isLoginRoute) {
    return redirectWithin(request, '/host')
  }

  return response
}

/**
 * Redirect inside the host area, keeping `lang` and dropping everything else.
 *
 * Dropping the query is deliberate — an inherited `?error=link` or a stale
 * `?checkout=success` carried into a redirect describes the request that was
 * refused, not the one being served. `lang` is the exception, because `/host`
 * and `/host/login` sit outside the locale tree and read their language from
 * exactly this parameter. Both redirects above used to clear it along with the
 * rest, so a signed-in host who clicked "Belépés" on `/hu` — a link that does
 * carry `?lang=hu` — was bounced to an English dashboard, and a signed-out one
 * reached an English login page. Validated through `isLocale`: it lands in a
 * URL the browser will show, and it must not echo back whatever was sent.
 */
function redirectWithin(request: NextRequest, pathname: string) {
  const target = request.nextUrl.clone()
  const lang = target.searchParams.get('lang')
  target.pathname = pathname
  target.search = ''
  if (lang && isLocale(lang)) target.searchParams.set('lang', lang)
  return NextResponse.redirect(target)
}

export const config = {
  // `/host/:path*` is the auth gate. `/:path*/` is every URL with a trailing
  // slash, for the redirect at the top of `proxy` — and nothing else, so a
  // signed-out visitor on `/` still gets a 200.
  matcher: ['/host/:path*', '/:path*/'],
}
