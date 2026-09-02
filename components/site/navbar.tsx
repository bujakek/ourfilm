'use client'

import { type Locale, localePath } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import { Aperture, Menu, X } from 'lucide-react'
import Link from 'next/link'

import { CREATE_EVENT_PATH, LOGIN_PATH } from '@/lib/routes'
import { marketingCopy } from '@/lib/marketing-copy'
import { useEffect, useState } from 'react'

/**
 * Absolute fragments (`/#occasions`, not `#occasions`): the navbar renders on
 * /arak, /rolunk and the other standalone pages too, where a bare fragment has
 * no target to scroll to. They are locale-relative now, so the target is the
 * homepage of the language the reader is already in.
 *
 * The ids themselves stay English — an anchor ends up in the address bar.
 */
const navHrefs = ['/#how-it-works', '/alkalmak', '/arak', '/rolunk']

export function Navbar({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].nav
  const navLinks = navHrefs.map((href, index) => ({
    href,
    label: copy.links[index],
  }))
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <nav
        className={cn(
          'glass-nav flex w-full max-w-4xl items-center rounded-full',
          'gap-2 py-2 pr-2 pl-4 sm:gap-6 sm:py-2.5 sm:pr-3 sm:pl-5',
          scrolled &&
            'glass-nav-scrolled py-1.5 pl-3 sm:gap-4 sm:py-1.5 sm:pr-2 sm:pl-4',
        )}
        aria-label={copy.aria}
      >
        <Link
          href={localePath(locale, '/')}
          className="flex shrink-0 items-center gap-2"
          aria-label={copy.home}
        >
          <span
            className={cn(
              'flex items-center justify-center rounded-full bg-white/5 transition-all duration-200',
              scrolled ? 'size-7' : 'size-8',
            )}
          >
            <Aperture
              className="size-4 text-accent"
              strokeWidth={1.6}
              aria-hidden="true"
            />
          </span>
          <span className="text-base font-semibold tracking-tight">
            OurFilm
          </span>
        </Link>

        <ul className="hidden flex-1 items-center justify-center gap-0.5 md:flex">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={localePath(locale, link.href)}
                className={cn(
                  'rounded-full text-foreground/80 transition-all duration-200 hover:text-foreground',
                  scrolled ? 'px-2.5 py-1.5 text-[13px]' : 'px-3 py-2 text-sm',
                )}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href={`${LOGIN_PATH}?lang=${locale}`}
          className={cn(
            'hidden shrink-0 rounded-full text-foreground/80 transition-all duration-200 hover:text-foreground md:inline-flex',
            scrolled ? 'px-2.5 py-1.5 text-[13px]' : 'px-3 py-2 text-sm',
          )}
        >
          {copy.login}
        </Link>

        <Link
          href={locale === 'en' ? '/hu' : '/en'}
          hrefLang={locale === 'en' ? 'hu' : 'en'}
          className="hidden shrink-0 rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
        >
          {locale === 'en' ? 'HU' : 'EN'}
        </Link>

        <Link
          href={`${CREATE_EVENT_PATH}?lang=${locale}`}
          className={cn(
            buttonVariants({ size: 'sm' }),
            'hidden md:inline-flex',
          )}
        >
          {copy.create}
        </Link>

        <Button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? copy.close : copy.open}
          aria-expanded={open}
          variant="ghost"
          size="icon"
          className="ml-auto md:hidden"
        >
          {open ? (
            <X className="size-5" aria-hidden="true" />
          ) : (
            <Menu className="size-5" aria-hidden="true" />
          )}
        </Button>
      </nav>

      {/* Mobile full-screen panel */}
      <div
        className={cn(
          'fixed inset-0 z-40 flex flex-col px-4 pt-24 transition-all duration-400 md:hidden',
          open
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0',
        )}
        // The panel stays mounted for the fade, so without `inert` its links
        // remain tab-focusable behind a closed menu.
        inert={!open}
      >
        <div className="absolute inset-0 -z-10 bg-background/80 backdrop-blur-2xl" />
        <div className="glass-strong flex flex-col gap-1 rounded-3xl p-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={localePath(locale, link.href)}
              onClick={() => setOpen(false)}
              className="rounded-2xl px-5 py-4 text-lg font-medium text-foreground/90 transition-colors hover:bg-white/5"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={`${LOGIN_PATH}?lang=${locale}`}
            onClick={() => setOpen(false)}
            className="rounded-2xl px-5 py-4 text-lg font-medium text-foreground/90 transition-colors hover:bg-white/5"
          >
            {copy.login}
          </Link>
          <Link
            href={locale === 'en' ? '/hu' : '/en'}
            hrefLang={locale === 'en' ? 'hu' : 'en'}
            onClick={() => setOpen(false)}
            className="rounded-2xl px-5 py-4 text-lg font-medium text-foreground/90 transition-colors hover:bg-white/5"
          >
            {locale === 'en' ? 'Magyar' : 'English'}
          </Link>
          <Link
            href={`${CREATE_EVENT_PATH}?lang=${locale}`}
            onClick={() => setOpen(false)}
            className={buttonVariants({
              size: 'lg',
              className: 'mt-2 w-full text-lg',
            })}
          >
            {copy.create}
          </Link>
        </div>
      </div>
    </header>
  )
}
