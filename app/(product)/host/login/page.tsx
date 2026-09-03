import { PageGrain } from '@/components/site/page-grain'
import { localeTag } from '@/lib/i18n'
import type { Metadata } from 'next'
import { LoginForm } from './login-form'

export const metadata: Metadata = {
  title: 'Log in – OurFilm',
  robots: { index: false, follow: false },
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; lang?: string }>
}) {
  const { error, lang } = await searchParams
  const locale = lang === 'hu' ? 'hu' : 'en'
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
            ? 'Enter your email and we will send you a secure sign-in link. No password needed.'
            : 'Add meg az e-mail-címed, és küldünk egy belépési linket. Ha még nincs fiókod, automatikusan létrehozzuk.'}
        </p>
        <LoginForm linkError={error === 'link'} locale={locale} />
      </main>
    </div>
  )
}
