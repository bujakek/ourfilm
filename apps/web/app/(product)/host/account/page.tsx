import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe2,
  LogOut,
  Mail,
  Trash2,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { SiInstagram } from 'react-icons/si'

import { AccountNameForm } from '@/components/host/account-name-form'
import { getCurrentHostProfile } from '@/lib/host-profile'
import { inputSurfaceClassName } from '@/components/ui/input'
import { localePath, localeTag, resolveLocale } from '@/lib/i18n'
import { CONTACT_EMAIL, INSTAGRAM_URL, SITE_URL } from '@/lib/site'

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

function SettingsLink({
  href,
  icon,
  children,
  external = false,
  destructive = false,
}: {
  href: string
  icon: ReactNode
  children: ReactNode
  external?: boolean
  destructive?: boolean
}) {
  const className = `flex min-h-18 items-center gap-4 border-b border-border px-1 text-base transition-colors last:border-b-0 ${
    destructive
      ? 'text-destructive hover:text-destructive/85'
      : 'text-foreground/80 hover:text-foreground'
  }`

  // The trailing mark is a promise about what tapping does. `Kapcsolat` is an
  // ordinary page on this site, and giving it the same arrow as Instagram told
  // a host they were about to leave — so only the rows that really do leave
  // get it, and the rest get the chevron every list row on a phone has.
  const leaves = external || href.startsWith('mailto:')
  const Affordance = leaves ? ExternalLink : ChevronRight
  const affordance = (
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
        {affordance}
      </a>
    )
  }

  return (
    <Link
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className={className}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {affordance}
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
      {/* A target rather than a sentence. This is the only way off the screen
          that is not an action, and at the top of a phone it has to be
          thumb-sized — the word beside it added nothing a chevron in the
          corner of a settings page does not already say. */}
      <Link
        href={`/host?lang=${locale}`}
        aria-label={en ? 'Back' : 'Vissza'}
        className="glass inline-flex size-11 items-center justify-center rounded-full text-foreground/80 transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-5" strokeWidth={2} aria-hidden="true" />
      </Link>

      <h1 className="mt-7 font-display text-[46px] leading-none tracking-[-0.015em] sm:text-[56px]">
        {en ? 'Account settings' : 'Fiókbeállítások'}
      </h1>

      <section className="mt-12" aria-labelledby="profile-heading">
        <h2
          id="profile-heading"
          className="font-mono text-[10px] font-medium tracking-[0.22em] text-foreground/42"
        >
          {en ? 'PERSONAL DETAILS' : 'SZEMÉLYES ADATOK'}
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

        {/* Drawn as a field, though nothing here can edit it. It is the same
            kind of fact as the name directly above — what the account *is* —
            and a bare line of text under a bordered input read as a caption
            belonging to the input rather than as its own value. Changing a
            sign-in address is an auth flow, not a settings row. */}
        <div className="mt-8">
          <p className="text-sm text-muted-foreground">
            {en ? 'Sign-in email' : 'Belépési e-mail-cím'}
          </p>
          <div
            className={`mt-2 ${inputSurfaceClassName} text-muted-foreground`}
          >
            <Mail
              className="size-5 shrink-0"
              strokeWidth={1.7}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate text-base text-foreground sm:text-sm">
              {profile.email}
            </span>
          </div>
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
            external
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
            href={homepage}
            external
            icon={
              <Globe2
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
              {en ? 'Sign out' : 'Kijelentkezés'}
            </button>
          </form>
          <SettingsLink
            href={`mailto:${CONTACT_EMAIL}?subject=${deletionSubject}`}
            destructive
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
