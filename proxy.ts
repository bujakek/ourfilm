import { publicSupabaseEnv } from '@/lib/supabase/env'
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Auth gate for the admin area.
 *
 * Next 16 renamed middleware: this file must be `proxy.ts` and the handler must
 * be `proxy`. A `middleware.ts` here would be silently ignored — no warning, no
 * error — leaving /admin open while looking guarded in the source tree.
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
 * the path as well, and `/admin/events/new` is one segment away from routes
 * that list and mutate real events.
 *
 * The screen that finishes the creation after signing up is deliberately **not**
 * here: it lives at `/auth/event-complete`, outside this matcher entirely. A
 * Server Action posts to the path of the page that owns it, so an `/admin/**`
 * path would mean this gate answering `createEventFromDraft`'s own POST with a
 * redirect and discarding the call. Its own page comment has the rest.
 */
const PUBLIC_ADMIN_PATHS = new Set(['/admin/events/new'])
export async function proxy(request: NextRequest) {
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

  const path = request.nextUrl.pathname
  const isLoginRoute = path.startsWith('/admin/login')
  const isPublicRoute = PUBLIC_ADMIN_PATHS.has(path)

  if (!user && !isLoginRoute && !isPublicRoute) {
    const redirectTo = request.nextUrl.clone()
    redirectTo.pathname = '/admin/login'
    redirectTo.search = ''
    return NextResponse.redirect(redirectTo)
  }

  // A signed-in host opening the login page is bounced to their events. The
  // public create flow is not: it works the same either way, and the only
  // difference is that they are not asked for an account at the end.
  if (user && isLoginRoute) {
    const redirectTo = request.nextUrl.clone()
    redirectTo.pathname = '/admin'
    redirectTo.search = ''
    return NextResponse.redirect(redirectTo)
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}
