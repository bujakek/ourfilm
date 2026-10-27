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

  // The grain comes from the host layout. The heading and the terms line are
  // the form's, because it swaps the whole screen once a link has gone out.
  return (
    <div className="flex min-h-[100dvh] flex-col justify-center px-5 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
      <main className="mx-auto w-full max-w-md" lang={localeTag[locale]}>
        <LoginForm
          linkError={error === 'link'}
          oauthError={error === 'oauth'}
          locale={locale}
          next={safeNext(next ?? `/host?lang=${locale}`, await requestOrigin())}
        />
      </main>
    </div>
  )
}
