import { isLocale } from '@/lib/i18n'
import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

// POST only: a GET sign-out can be triggered by any image or link pointing at
// it, which would log the host out at random.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  // The login page has no locale segment to read, so the language has to
  // survive the round trip or a Hungarian host is signed out into English.
  // Validated rather than forwarded: it ends up in a URL the browser displays.
  const lang = new URL(request.url).searchParams.get('lang')
  const destination = new URL('/host/login', request.url)
  if (lang && isLocale(lang)) destination.searchParams.set('lang', lang)

  return NextResponse.redirect(destination, { status: 303 })
}
