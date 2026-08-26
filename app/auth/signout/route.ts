import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

// POST only: a GET sign-out can be triggered by any image or link pointing at
// it, which would log the host out at random.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/host/login', request.url), {
    status: 303,
  })
}
