import Link from 'next/link'

import { localePath, type Locale } from '@/lib/i18n'

/** The terms line under both ways in: the login screen and the onboarding
 *  save screen. Sky links, as the landing page draws them. */
export function AuthLegalNotice({ locale }: { locale: Locale }) {
  const en = locale === 'en'
  return (
    <div className="mt-4 text-center text-[12px] leading-[1.6] text-pretty text-white/60">
      <p>
        {en
          ? 'How we handle your sign-in data and the terms for using OurFilm:'
          : 'A belépési adatok kezeléséről és az OurFilm használatának feltételeiről:'}
      </p>
      <div className="flex flex-wrap justify-center gap-x-4">
        <Link
          href={localePath(locale, '/adatvedelem')}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center text-landing-sky underline underline-offset-[3px] transition-colors hover:text-white"
        >
          {en ? 'Privacy Notice' : 'Adatkezelési tájékoztató'}
          <span className="sr-only">
            {en ? ' (opens in a new tab)' : ' (új lapon nyílik meg)'}
          </span>
        </Link>
        <Link
          href={localePath(locale, '/aszf')}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center text-landing-sky underline underline-offset-[3px] transition-colors hover:text-white"
        >
          {en ? 'Terms of Service' : 'ÁSZF'}
          <span className="sr-only">
            {en ? ' (opens in a new tab)' : ' (új lapon nyílik meg)'}
          </span>
        </Link>
      </div>
    </div>
  )
}
