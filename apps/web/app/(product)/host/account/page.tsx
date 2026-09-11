import {
  ChevronRight,
  ExternalLink,
  Globe,
  LogOut,
  Mail,
  Trash2,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { SiInstagram, SiTiktok } from 'react-icons/si'

import { AccountNameForm } from '@/components/host/account-name-form'
import { BackLink } from '@/components/ui/back-link'
import { getCurrentHostProfile } from '@/lib/host-profile'
import { localePath, localeTag, resolveLocale } from '@/lib/i18n'
import { CONTACT_EMAIL, INSTAGRAM_URL, SITE_URL, TIKTOK_URL } from '@/lib/site'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>
}): Promise<Metadata> {
  const { lang } = await searchParams
  return {
    title:
      resolveLocale(lang) === 'hu'
        ? 'Fiókbeállítások — OurFilm'
        : 'Account settings — OurFilm',
    robots: { index: false, follow: false },
  }
}

/**
 * One row of the account screen.
 *
 * `affordance` is passed rather than inferred, and that is the design talking
 * rather than an oversight. The trailing mark here belongs to the *section*:
 * everything under OURFILM is somewhere else to read, and everything under
 * FIÓKMŰVELETEK is something this account does. `Kapcsolat` is an ordinary page
 * on this site and still takes the outbound mark, because on that row it reads
 * as "one of the OurFilm links" rather than as a promise about tab handling.
 */
function SettingsLink({
  href,
  icon,
  children,
  affordance,
  destructive = false,
}: {
  href: string
  icon: ReactNode
  children: ReactNode
  affordance: 'external' | 'chevron'
  destructive?: boolean
}) {
  const className = `flex min-h-18 items-center gap-4 border-b border-border px-1 text-base transition-colors last:border-b-0 ${
    destructive
      ? 'text-destructive hover:text-destructive/85'
      : 'text-foreground/80 hover:text-foreground'
  }`

  const Affordance = affordance === 'external' ? ExternalLink : ChevronRight
  const trailing = (
    <Affordance
      className="size-4 text-muted-foreground"
      strokeWidth={1.8}
      aria-hidden="true"
    />
  )

  if (href.startsWith('mailto:')) {
    return (
      <a href={href} className={className}>
        {icon}
        <span className="flex-1">{children}</span>
        {trailing}
      </a>
    )
  }

  return (
    <Link
      href={href}
      // One prop decides the mark and the tab together. A row that shows the
      // outbound arrow and then replaces the page is the arrow lying, and the
      // two drifted apart the moment they were separate props.
      target={affordance === 'external' ? '_blank' : undefined}
      rel={affordance === 'external' ? 'noopener noreferrer' : undefined}
      className={className}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {trailing}
    </Link>
  )
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>
}) {
  const { lang } = await searchParams
  const locale = resolveLocale(lang)
  const en = locale === 'en'
  const profile = await getCurrentHostProfile()
  if (!profile) redirect(`/host/login?lang=${locale}`)

  const homepage = `${SITE_URL}/${locale}`
  const deletionSubject = encodeURIComponent(
    en ? 'OurFilm account deletion request' : 'OurFilm-fiók törlése',
  )

  return (
    <main
      className="mx-auto w-full max-w-3xl px-4 pt-7 pb-16 sm:px-6 sm:pt-12"
      lang={localeTag[locale]}
    >
      <BackLink href={`/host?lang=${locale}`}>
        {en ? 'Your events' : 'Eseményeid'}
      </BackLink>

      <h1 className="mt-7 font-display text-[46px] leading-none tracking-[-0.015em] sm:text-[56px]">
        {en ? 'Account settings' : 'Fiókbeállítások'}
      </h1>

      <section className="mt-12" aria-labelledby="profile-heading">
        <h2
          id="profile-heading"
          className="font-mono text-[10px] font-medium tracking-[0.22em] text-foreground/42"
        >
          {en ? 'PROFILE' : 'PROFIL'}
        </h2>
        <div className="mt-5">
          {profile.canEditName ? (
            <AccountNameForm name={profile.displayName} locale={locale} />
          ) : (
            // The read failed, so the write would too. Show the name that is
            // actually on the photos rather than a form that cannot save.
            <div>
              <p className="text-sm text-muted-foreground">
                {en ? 'Display name' : 'Megjelenített név'}
              </p>
              <p className="mt-1.5 text-base text-foreground">
                {profile.displayName}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
                {en
                  ? 'Changing the name is briefly unavailable. Your photos are still credited to this name.'
                  : 'A név módosítása most nem érhető el. A képeidnél továbbra is ez a név jelenik meg.'}
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 border-b border-border pb-7">
          <p className="text-sm text-muted-foreground">
            {en ? 'Sign-in email' : 'Belépési e-mail-cím'}
          </p>
          <p className="mt-1.5 text-base break-all text-foreground">
            {profile.email}
          </p>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="ourfilm-heading">
        <h2
          id="ourfilm-heading"
          className="font-mono text-[10px] font-medium tracking-[0.22em] text-foreground/42"
        >
          OURFILM
        </h2>
        <nav
          aria-label={en ? 'OurFilm links' : 'OurFilm-linkek'}
          className="mt-4 border-y border-border"
        >
          <SettingsLink
            href={INSTAGRAM_URL}
            affordance="external"
            icon={
              <SiInstagram
                className="size-[19px] text-foreground/75"
                aria-hidden="true"
              />
            }
          >
            Instagram
          </SettingsLink>
          <SettingsLink
            href={TIKTOK_URL}
            affordance="external"
            icon={
              <SiTiktok
                className="size-[19px] text-foreground/75"
                aria-hidden="true"
              />
            }
          >
            TikTok
          </SettingsLink>
          <SettingsLink
            href={homepage}
            affordance="external"
            icon={
              <Globe
                className="size-5 text-foreground/75"
                strokeWidth={1.7}
                aria-hidden="true"
              />
            }
          >
            {en ? 'Website' : 'Weboldal'}
          </SettingsLink>
          <SettingsLink
            href={localePath(locale, '/kapcsolat')}
            affordance="external"
            icon={
              <Mail
                className="size-5 text-foreground/75"
                strokeWidth={1.7}
                aria-hidden="true"
              />
            }
          >
            {en ? 'Contact' : 'Kapcsolat'}
          </SettingsLink>
        </nav>
      </section>

      <section className="mt-12" aria-labelledby="actions-heading">
        <h2
          id="actions-heading"
          className="font-mono text-[10px] font-medium tracking-[0.22em] text-foreground/42"
        >
          {en ? 'ACCOUNT ACTIONS' : 'FIÓKMŰVELETEK'}
        </h2>
        <div className="mt-4 border-y border-border">
          <form action={`/auth/signout?lang=${locale}`} method="post">
            <button
              type="submit"
              className="flex min-h-18 w-full items-center gap-4 border-b border-border px-1 text-left text-base text-foreground/80 transition-colors hover:text-foreground"
            >
              <LogOut
                className="size-5 text-foreground/75"
                strokeWidth={1.7}
                aria-hidden="true"
              />
              <span className="flex-1">
                {en ? 'Sign out' : 'Kijelentkezés'}
              </span>
              <ChevronRight
                className="size-4 text-muted-foreground"
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </button>
          </form>
          <SettingsLink
            href={`mailto:${CONTACT_EMAIL}?subject=${deletionSubject}`}
            destructive
            affordance="chevron"
            icon={
              <Trash2 className="size-5" strokeWidth={1.7} aria-hidden="true" />
            }
          >
            {en ? 'Delete account' : 'Fiók törlése'}
          </SettingsLink>
        </div>
      </section>
    </main>
  )
}
