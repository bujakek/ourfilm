'use client'

import {
  Cake,
  ChevronDown,
  Menu,
  PartyPopper,
  Plane,
  Wine,
  X,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type MouseEvent } from 'react'

import { MenuMark } from '@/components/brand/menu-mark'
import { type Locale, localePath } from '@/lib/i18n'
import { landingCopy } from '@/lib/landing-copy'
import { rememberLocalePreference } from '@/lib/locale-preference'
import { occasionPath, occasions, type OccasionId } from '@/lib/occasions'
import { CREATE_EVENT_PATH, LOGIN_PATH } from '@/lib/routes'
import { demoEventUrl } from '@/lib/site'
import { useScrollLock } from '@/lib/use-scroll-lock'
import { cn } from '@/lib/utils'

import { LANDING_CONTAINER } from './layout'

const OCCASION_ICONS: Record<OccasionId, LucideIcon> = {
  wedding: PartyPopper,
  party: Wine,
  travel: Plane,
  birthday: Cake,
}

/** The labels in the bar and the menu: small, wide-set capitals. */
const NAV_LABEL = 'text-[13px] font-medium tracking-[0.24em] uppercase'

/**
 * The homepage's navigation, which is two different objects.
 *
 * On a desktop it is a bar pinned to the **bottom** of the window, the way the
 * approved design draws it: the page scrolls up behind a frosted strip, and
 * the occasions menu opens upwards out of it. On a phone it is an ordinary
 * top bar whose menu drops down as a sheet of grouped rows.
 *
 * The pages around the homepage (pricing, occasions, blog, legal) use it too.
 * On the homepage "How it works" and "Questions" are bare fragments; anywhere
 * else they lead back to the same sections on the homepage. The page a
 * visitor is on is marked with `aria-current` and the sky ink.
 */
export function LandingNav({ locale }: { locale: Locale }) {
  const copy = landingCopy[locale].nav
  const targetLocale: Locale = locale === 'en' ? 'hu' : 'en'
  const createHref = `${CREATE_EVENT_PATH}?lang=${locale}`
  const demoHref = demoEventUrl(locale)
  const pathname = usePathname()
  const homeHref = localePath(locale, '/')
  const home = pathname === homeHref
  const nav: NavPlace = {
    home,
    homeHref,
    anchor: (id) => (home ? `#${id}` : `${homeHref}#${id}`),
    isCurrent: (path) => {
      const target = localePath(locale, path)
      return pathname === target || pathname.startsWith(`${target}/`)
    },
    occasionsHref: localePath(locale, '/alkalmak'),
  }
  const occasionLinks = occasions.map((occasion) => ({
    id: occasion.id,
    href: occasionPath(locale, occasion),
    label: copy.occasionItems[occasion.id],
    Icon: OCCASION_ICONS[occasion.id],
  }))

  return (
    <>
      <DesktopBar
        locale={locale}
        targetLocale={targetLocale}
        createHref={createHref}
        demoHref={demoHref}
        occasionLinks={occasionLinks}
        nav={nav}
      />
      <MobileBar
        locale={locale}
        targetLocale={targetLocale}
        createHref={createHref}
        demoHref={demoHref}
        occasionLinks={occasionLinks}
        nav={nav}
      />
    </>
  )
}

/** Where the bar is, so it can link home and mark the current page. */
interface NavPlace {
  home: boolean
  homeHref: string
  /** A homepage section: a fragment at home, a round trip elsewhere. */
  anchor: (id: string) => string
  /** A locale-relative path such as `/arak`, matched with its subpages. */
  isCurrent: (path: string) => boolean
  occasionsHref: string
}

interface BarProps {
  locale: Locale
  targetLocale: Locale
  createHref: string
  demoHref: string
  occasionLinks: { id: string; href: string; label: string; Icon: LucideIcon }[]
  nav: NavPlace
}

export function Brand({ size }: { size: 'lg' | 'sm' }) {
  return (
    <>
      <MenuMark
        className={size === 'lg' ? 'h-[31px] w-[27px]' : 'h-[27px] w-[23px]'}
      />
      <span
        className={cn(
          'font-medium whitespace-nowrap text-white',
          size === 'lg'
            ? 'text-[27px] tracking-[-1.3px]'
            : 'text-[23px] tracking-[-1px]',
        )}
      >
        OurFilm
      </span>
    </>
  )
}

function DesktopBar({
  locale,
  targetLocale,
  createHref,
  demoHref,
  occasionLinks,
  nav,
}: BarProps) {
  const copy = landingCopy[locale].nav
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Escape and a click anywhere else both close it — a menu that only closes
  // one way is a trap for whoever arrived the other way.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    const onPointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [menuOpen])

  const link = cn(
    NAV_LABEL,
    'rounded-lg px-1 py-2 text-white transition-colors hover:text-white/70 aria-[current=page]:text-site-current',
  )
  const current = (path: string) =>
    nav.isCurrent(path) ? ('page' as const) : undefined

  return (
    <header className="fixed inset-x-0 bottom-0 z-50 hidden lg:block">
      <nav
        aria-label={copy.aria}
        className="relative rounded-t-[24px] bg-white/6 pt-3.5 pb-3 backdrop-blur-[30px]"
      >
        <div
          className={cn(LANDING_CONTAINER, 'flex h-[51px] items-center gap-6')}
        >
          <Link
            href={nav.home ? '#top' : nav.homeHref}
            aria-label={copy.home}
            className="flex shrink-0 items-center gap-[7px]"
          >
            <Brand size="lg" />
          </Link>

          <ul className="absolute left-1/2 flex -translate-x-1/2 items-center gap-6 whitespace-nowrap xl:gap-[39px]">
            <li>
              <Link href={nav.anchor('how-it-works')} className={link}>
                {copy.howItWorks}
              </Link>
            </li>
            <li>
              <Link href={demoHref} className={link}>
                {copy.demo}
              </Link>
            </li>
            <li>
              <Link
                href={localePath(locale, '/arak')}
                aria-current={current('/arak')}
                className={link}
              >
                {copy.pricing}
              </Link>
            </li>
            <li>
              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  aria-expanded={menuOpen}
                  aria-controls="landing-occasions-menu"
                  onClick={() => setMenuOpen((open) => !open)}
                  className={cn(
                    link,
                    'flex items-center gap-2 rounded-lg px-2',
                    menuOpen && 'bg-white/6',
                    nav.isCurrent('/alkalmak') && 'text-site-current',
                  )}
                >
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      'size-3.5 text-white/60 transition-transform',
                      menuOpen && 'rotate-180',
                    )}
                    strokeWidth={1.6}
                  />
                  {copy.occasions}
                </button>
                <ul
                  id="landing-occasions-menu"
                  inert={!menuOpen}
                  className={cn(
                    'absolute bottom-full left-0 mb-3 w-max min-w-[176px] rounded-[16px] bg-landing-raised p-2 shadow-[0_24px_60px_-24px_rgba(0,0,0,.9)] transition-[opacity,translate] duration-200',
                    menuOpen
                      ? 'translate-y-0 opacity-100'
                      : 'pointer-events-none translate-y-1 opacity-0',
                  )}
                >
                  <li>
                    <Link
                      href={nav.occasionsHref}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        NAV_LABEL,
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-3.5 text-white/60 transition-colors hover:bg-white/5 hover:text-white',
                      )}
                    >
                      {copy.allOccasions}
                    </Link>
                  </li>
                  {occasionLinks.map(({ id, href, label, Icon }) => (
                    <li key={id} className="border-t border-white/8">
                      <Link
                        href={href}
                        onClick={() => setMenuOpen(false)}
                        className={cn(
                          NAV_LABEL,
                          'flex items-center gap-2.5 rounded-lg px-2.5 py-3.5 text-white transition-colors hover:bg-white/5',
                        )}
                      >
                        <Icon
                          aria-hidden="true"
                          className="size-3.5 shrink-0 text-white/60"
                          strokeWidth={1.6}
                        />
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
            <li>
              <Link
                href={localePath(locale, '/blog')}
                aria-current={current('/blog')}
                className={link}
              >
                {copy.blog}
              </Link>
            </li>
          </ul>

          <div className="ml-auto flex shrink-0 items-center gap-5">
            <Link
              href={`${LOGIN_PATH}?lang=${locale}`}
              className={cn(
                NAV_LABEL,
                'hidden text-[12px] text-white/55 transition-colors hover:text-white min-[1440px]:inline',
              )}
            >
              {copy.login}
            </Link>
            <Link
              href={localePath(targetLocale, '/')}
              hrefLang={targetLocale}
              // The one place a language preference is saved: `/` reads it on
              // the next visit. Visiting `/hu` or `/en` directly saves nothing.
              onClick={() => rememberLocalePreference(targetLocale)}
              className={cn(
                NAV_LABEL,
                'hidden text-[12px] text-white/55 transition-colors hover:text-white min-[1440px]:inline',
              )}
            >
              {targetLocale.toUpperCase()}
            </Link>
            <Link
              href={createHref}
              className="inline-flex h-[43px] items-center rounded-[14px] bg-white px-4 text-[15px] font-medium whitespace-nowrap text-landing-ink transition-colors hover:bg-white/90"
            >
              {copy.create}
            </Link>
          </div>
        </div>
      </nav>
    </header>
  )
}

function MobileBar({
  locale,
  targetLocale,
  createHref,
  demoHref,
  occasionLinks,
  nav,
}: BarProps) {
  const copy = landingCopy[locale].nav
  const [open, setOpen] = useState(false)
  useScrollLock(open)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // The scroll lock pins `<body>` while the sheet is open, so a fragment link
  // would jump a page that is not scrolling and then be undone by the unlock.
  // Close first, and scroll once the page is free again.
  const goTo = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    setOpen(false)
    // Off the homepage the link is a real navigation; let it happen.
    if (!nav.home) return
    e.preventDefault()
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }),
      ),
    )
  }

  const row = cn(
    NAV_LABEL,
    'flex min-h-[52px] items-center gap-2.5 border-b border-white/8 px-4 text-[14px] text-white',
  )
  const plainRow = cn(row, 'pl-[37px]')
  const group =
    'px-0 pt-5 pb-1 text-[13px] font-medium tracking-[0.2em] text-white/40 uppercase'

  return (
    <header className="lg:hidden">
      <div className="fixed inset-x-0 top-0 z-50 flex h-[70px] items-center justify-between bg-landing/85 px-5 backdrop-blur-md">
        <Link
          href={nav.home ? '#top' : nav.homeHref}
          aria-label={copy.home}
          className="flex items-center gap-[5px]"
        >
          <Brand size="sm" />
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? copy.close : copy.open}
          aria-expanded={open}
          aria-controls="landing-mobile-menu"
          className="-mr-2 flex size-11 items-center justify-center text-white"
        >
          {open ? (
            <X aria-hidden="true" className="size-6" strokeWidth={1.5} />
          ) : (
            <Menu aria-hidden="true" className="size-6" strokeWidth={1.5} />
          )}
        </button>
      </div>

      <div
        id="landing-mobile-menu"
        inert={!open}
        className={cn(
          'fixed inset-0 z-40 transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        {/* Tapping the page below the sheet closes it. */}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => setOpen(false)}
          className="absolute inset-0 h-full w-full cursor-default"
        />
        <nav
          aria-label={copy.aria}
          className={cn(
            'relative max-h-full overflow-y-auto overscroll-contain rounded-b-[24px] bg-landing-sheet px-5 pt-[70px] pb-6 shadow-[0_30px_60px_-30px_rgba(0,0,0,.9)] transition-transform duration-300',
            open ? 'translate-y-0' : '-translate-y-4',
          )}
        >
          <p className={cn(group, 'pt-2')}>OurFilm</p>
          <ul>
            <li>
              <Link
                href={createHref}
                onClick={() => setOpen(false)}
                className={row}
              >
                <MenuMark className="h-[14px] w-[12px]" />
                {copy.create}
              </Link>
            </li>
            <li>
              <Link
                href={demoHref}
                onClick={() => setOpen(false)}
                className={plainRow}
              >
                {copy.tryAsGuest}
              </Link>
            </li>
            <li>
              <Link
                href={`${LOGIN_PATH}?lang=${locale}`}
                onClick={() => setOpen(false)}
                className={plainRow}
              >
                {copy.login}
              </Link>
            </li>
          </ul>

          <p className={group}>{copy.explore}</p>
          <ul>
            <li>
              <Link
                href={nav.anchor('how-it-works')}
                onClick={(e) => goTo(e, 'how-it-works')}
                className={plainRow}
              >
                {copy.howItWorks}
              </Link>
            </li>
            <li>
              <Link
                href={localePath(locale, '/blog')}
                onClick={() => setOpen(false)}
                className={plainRow}
              >
                {copy.blog}
              </Link>
            </li>
            <li>
              <Link
                href={localePath(locale, '/arak')}
                onClick={() => setOpen(false)}
                className={plainRow}
              >
                {copy.pricing}
              </Link>
            </li>
            <li>
              <Link
                href={nav.anchor('faq')}
                onClick={(e) => goTo(e, 'faq')}
                className={plainRow}
              >
                {copy.faq}
              </Link>
            </li>
            <li>
              <Link
                href={localePath(targetLocale, '/')}
                hrefLang={targetLocale}
                onClick={() => {
                  rememberLocalePreference(targetLocale)
                  setOpen(false)
                }}
                className={plainRow}
              >
                {targetLocale === 'en' ? 'English' : 'Magyar'}
              </Link>
            </li>
          </ul>

          <p className={group}>{copy.occasions}</p>
          <ul>
            <li>
              <Link
                href={nav.occasionsHref}
                onClick={() => setOpen(false)}
                className={plainRow}
              >
                {copy.allOccasions}
              </Link>
            </li>
            {occasionLinks.map(({ id, href, label, Icon }, i) => (
              <li key={id}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    row,
                    i === occasionLinks.length - 1 && 'border-b-0',
                  )}
                >
                  <Icon
                    aria-hidden="true"
                    className="size-3.5 text-white/70"
                    strokeWidth={1.6}
                  />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}
