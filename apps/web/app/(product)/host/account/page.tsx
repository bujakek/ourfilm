import { getHostLocale } from '@/lib/host-locale'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { AccountLanguageSelect } from '@/components/host/account-language-select'
import { AccountNameForm } from '@/components/host/account-name-form'
import {
  HOST_FOCUS,
  HOST_KICKER,
  HOST_PANEL,
  HOST_ROW_DETAIL,
  HOST_ROW_QUESTION,
  HOST_SECONDARY,
  HOST_TITLE,
} from '@/components/host/ui/classes'
import { BackLink } from '@/components/ui/back-link'
import { getCurrentHostProfile } from '@/lib/host-profile'
import { getHostAlbumTotals } from '@/lib/host-totals'
import { huNumberArticle } from '@/lib/host-ui'
import { localeTag, type Locale } from '@/lib/i18n'
import { CONTACT_EMAIL } from '@/lib/site'
import { reportServerIssue } from '@/lib/telemetry-server'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>
}): Promise<Metadata> {
  const { lang } = await searchParams
  return {
    title:
      (await getHostLocale(lang)) === 'hu'
        ? 'Fiókbeállítások — OurFilm'
        : 'Account settings — OurFilm',
    robots: { index: false, follow: false },
  }
}

function Figure({ children }: { children: ReactNode }) {
  return <span className="host-figure text-[18px] text-white">{children}</span>
}

/**
 * What deleting the account takes with it (8e). The counts are the reason the
 * sentence exists, so a host with nothing yet is told so plainly, and a failed
 * count falls back to a sentence that claims no number.
 */
function deletionDetail(
  totals: { events: number; photos: number } | null,
  locale: Locale,
): ReactNode {
  const en = locale === 'en'
  const keep = en
    ? 'Download what you want to keep first. This cannot be undone.'
    : 'Előbb töltsd le, amit meg akarsz tartani. Nem vonható vissza.'

  if (!totals) {
    return en
      ? `All your events and photos are deleted. ${keep}`
      : `Az összes eseményed és képed törlődik. ${keep}`
  }
  const { events, photos } = totals
  if (events === 0) {
    return en
      ? 'Your account is deleted. This cannot be undone.'
      : 'A fiókod véglegesen törlődik. Nem vonható vissza.'
  }
  const article = huNumberArticle(events) === 'az' ? 'Az' : 'A'
  if (photos === 0) {
    return en ? (
      <>
        Your <Figure>{events}</Figure>{' '}
        {events === 1 ? 'event is' : 'events are'} deleted. This cannot be
        undone.
      </>
    ) : (
      <>
        {article} <Figure>{events}</Figure> esemény törlődik. Nem vonható
        vissza.
      </>
    )
  }
  return en ? (
    <>
      Your <Figure>{events}</Figure> {events === 1 ? 'event' : 'events'} and all{' '}
      <Figure>{photos}</Figure> {photos === 1 ? 'photo' : 'photos'} are deleted.{' '}
      {keep}
    </>
  ) : (
    <>
      {article} <Figure>{events}</Figure> esemény és az összes{' '}
      <Figure>{photos}</Figure> kép törlődik. {keep}
    </>
  )
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>
}) {
  const { lang } = await searchParams
  // The profile's language; `?lang` only for an account with none yet.
  const locale = await getHostLocale(lang)
  const en = locale === 'en'
  const profile = await getCurrentHostProfile()
  if (!profile) redirect(`/host/login?lang=${locale}`)

  // Contained: the counts only colour one sentence, and a failed read must not
  // take sign-out and the name form down with it.
  const totals = await getHostAlbumTotals(profile.id).catch(async (error) => {
    console.error('Could not count the host albums', error)
    await reportServerIssue(error, {
      operation: 'host_album_totals',
      route: '/host/account',
      routeType: 'page',
      method: 'GET',
    })
    return null
  })

  const deletionSubject = encodeURIComponent(
    en ? 'OurFilm account deletion request' : 'OurFilm-fiók törlése',
  )

  return (
    <main
      className="mx-auto w-full max-w-lg px-5 pt-7 pb-11 sm:px-7"
      lang={localeTag[locale]}
    >
      <BackLink href={`/host?lang=${locale}`}>
        {en ? 'Your events' : 'Eseményeid'}
      </BackLink>

      <h1 className={`mt-3 ${HOST_TITLE}`}>{en ? 'Account' : 'Fiók'}</h1>

      <div className="mt-7 flex flex-col gap-3">
        <section className={`${HOST_PANEL} p-5`}>
          <h2 className={HOST_KICKER}>{en ? 'Email' : 'E-mail'}</h2>
          <p className="mt-1.5 text-[16px] leading-[1.5] font-medium break-all text-white">
            {profile.email}
          </p>
          <p className={`mt-0.5 ${HOST_ROW_DETAIL}`}>
            {en
              ? 'You sign in with Google or an email link.'
              : 'Google-fiókkal vagy e-mail linkkel lépsz be.'}
          </p>
        </section>

        <section className={`${HOST_PANEL} p-5`}>
          {profile.canEditName ? (
            <AccountNameForm name={profile.displayName} locale={locale} />
          ) : (
            // The read failed, so the write would too. Show the name that is
            // actually on the photos rather than a form that cannot save.
            <div>
              <h2 className={HOST_ROW_QUESTION}>
                {en ? 'Display name' : 'Megjelenített név'}
              </h2>
              <p className="mt-1 text-[16px] leading-[1.5] break-words text-white">
                {profile.displayName}
              </p>
              <p className={`mt-2 ${HOST_ROW_DETAIL}`}>
                {en
                  ? 'Changing the name is briefly unavailable. Your photos are still credited to this name.'
                  : 'A név módosítása most nem érhető el. A képeidnél továbbra is ez a név jelenik meg.'}
              </p>
            </div>
          )}
        </section>

        <section className={`${HOST_PANEL} p-5`}>
          <AccountLanguageSelect locale={locale} />
        </section>

        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className={`${HOST_PANEL} flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-white/6 ${HOST_FOCUS}`}
        >
          <span className={HOST_ROW_QUESTION}>
            {en ? 'Contact' : 'Kapcsolat'}
          </span>
          <span className="min-w-0 text-[14px] break-all text-white/65">
            {CONTACT_EMAIL}
          </span>
        </a>

        <form action={`/auth/signout?lang=${locale}`} method="post">
          <button type="submit" className={`${HOST_SECONDARY} w-full`}>
            {en ? 'Sign out' : 'Kijelentkezés'}
          </button>
        </form>
      </div>

      {/* Set apart, at the bottom: the one thing on this screen that cannot
          be taken back. Still a request by email; nothing here deletes. */}
      <section className={`mt-10 ${HOST_PANEL} p-5`}>
        <h2 className={HOST_ROW_QUESTION}>
          {en ? 'Delete account' : 'Fiók törlése'}
        </h2>
        <p className={HOST_ROW_DETAIL}>{deletionDetail(totals, locale)}</p>
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=${deletionSubject}`}
          className={`mt-4 inline-flex h-12 w-full items-center justify-center rounded-[14px] bg-host-danger-fill px-6 text-[15px] font-medium text-host-danger transition-opacity hover:opacity-85 ${HOST_FOCUS}`}
        >
          {en ? 'Delete account' : 'Fiók törlése'}
        </a>
      </section>
    </main>
  )
}
