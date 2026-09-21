import Link from 'next/link'

import { localePath, type Locale } from '@/lib/i18n'

export function AuthLegalNotice({ locale }: { locale: Locale }) {
  const en = locale === 'en'
  return (
    <div className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
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
          className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-foreground"
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
          className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-foreground"
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
