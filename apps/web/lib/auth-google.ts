import { authCallbackUrl } from '@/lib/auth-redirect'
import type { Locale } from '@/lib/i18n'
import { createClient } from '@/lib/supabase/client'

export async function signInWithGoogle({
  next,
  locale,
}: {
  next: string
  locale: Locale
}): Promise<{ status: 'redirecting' } | { status: 'error'; message: string }> {
  try {
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: authCallbackUrl({
          origin: window.location.origin,
          next,
          locale,
          provider: 'google',
        }),
      },
    })
    if (!error) return { status: 'redirecting' }
  } catch {
    // Network failures must release the button so either method can be retried.
  }
  return {
    status: 'error',
    message:
      locale === 'en'
        ? 'Could not start Google sign-in. Try again or use an email link.'
        : 'Nem sikerült elindítani a Google-belépést. Próbáld újra, vagy kérj e-mailes linket.',
  }
}
