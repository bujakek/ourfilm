import { PageGrain } from '@/components/site/page-grain'
import { AuthLegalNotice } from '@/components/host/auth-legal-notice'
import { localeTag, resolveLocale } from '@/lib/i18n'
import type { Metadata } from 'next'
import { requestOrigin } from '@/lib/request-origin'
import { safeNext } from '@/lib/safe-next'
import { LoginForm } from './login-form'

export const metadata: Metadata = {
  title: 'Log in – OurFilm',
  robots: { index: false, follow: false },
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; lang?: string; next?: string }>
}) {
  const { error, lang, next } = await searchParams
  const locale = resolveLocale(lang)
  const en = locale === 'en'

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <PageGrain />
      <main className="relative z-10 w-full max-w-sm" lang={localeTag[locale]}>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          {en ? 'Welcome back' : 'Kezdd el ingyen'}
        </h1>
        <p className="mt-3 mb-8 leading-relaxed text-pretty text-muted-foreground">
          {en
            ? 'Continue with Google or get a sign-in link by email. No password needed.'
            : 'Folytasd Google-lel, vagy kérj e-mailes belépési linket. Ha még nincs fiókod, automatikusan létrehozzuk.'}
        </p>
        <LoginForm
          linkError={error === 'link'}
          oauthError={error === 'oauth'}
          locale={locale}
          next={safeNext(next ?? `/host?lang=${locale}`, await requestOrigin())}
        />
        <AuthLegalNotice locale={locale} />
      </main>
    </div>
  )
}
