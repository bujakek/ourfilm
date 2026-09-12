'use client'

import { type Locale, localePath } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { MenuMark } from '@/components/brand/menu-mark'
import { Button, buttonVariants } from '@/components/ui/button'
import { Menu, X } from 'lucide-react'
import Link from 'next/link'

import { OCCASIONS_ARE_DRAFT, occasionCopy, occasions } from '@/lib/occasions'
import { CREATE_EVENT_PATH, LOGIN_PATH } from '@/lib/routes'
import { marketingCopy } from '@/lib/marketing-copy'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * Absolute fragments (`/#occasions`, not `#occasions`): the navbar renders on
 * /arak, /rolunk and the other standalone pages too, where a bare fragment has
 * no target to scroll to. They are locale-relative now, so the target is the
 * homepage of the language the reader is already in.
 *
 * The ids themselves stay English — an anchor ends up in the address bar.
 */
const NAV_ITEMS = [
  { href: '/#how-it-works' },
  // The one item with somewhere to go *and* children worth showing. It became
  // a menu when the four occasion pages stopped being drafts: sending someone
  // to an index so they can pick one is a click spent on a decision the navbar
  // could have shown them.
  { href: '/alkalmak', draft: OCCASIONS_ARE_DRAFT, menu: true },
  { href: '/arak' },
  { href: '/rolunk' },
]

export function Navbar({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].nav
  // Labelled before it is filtered: `copy.links` is index-mapped to the list
  // above, so dropping an entry first would shift every label after it by one.
  const navLinks = NAV_ITEMS.map((item, index) => ({
    ...item,
    label: copy.links[index],
  })).filter((item) => !item.draft)
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  // Which desktop menu is showing, by href. One at a time, and `null` when
  // none — a boolean per item would let two panels overlap the first time a
  // second menu is added.
  const [menu, setMenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // A hover menu that only closes on mouseleave is a trap for anyone who
  // opened it from the keyboard, and one that only closes on blur is a trap
  // for anyone who opened it with a mouse and then clicked the page. Both, and
  // Escape, because each covers a way in the other does not.
  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null)
    }
    const onPointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [menu])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    // A full-width bar on a rule, not a floating pill. The hero underneath is
    // one photograph now, and a pill hovering over it was a second object
    // competing with the ticket for the same attention.
    //
    // `.glass-nav` stays as the material, and so does its `saturate(220%)`-only
    // touch-device override: this is still the one surface in the product that
    // genuinely sits over photography, which is the case that comment in
    // `globals.css` was written for.
    <header className="fixed inset-x-0 top-0 z-50">
      <nav
        className={cn(
          'glass-nav flex w-full items-center rounded-none border-x-0 border-t-0 border-b border-border',
          'gap-2 px-4 py-2.5 sm:gap-6 sm:px-6 sm:py-3',
          // `relative z-50` is load-bearing, not tidiness. The mobile panel is
          // a later sibling inside this same header, `fixed` with `z-40`, and
          // a positioned element with a z-index paints over a *static* one
          // whatever the source order says. So the bar — and the close button
          // in it — sat underneath the open menu and could not be tapped. The
          // panel's own `-z-10` backdrop only sends it behind the panel's
          // contents, never behind the nav.
          'relative z-50',
          scrolled && 'glass-nav-scrolled py-2 sm:py-2',
        )}
        aria-label={copy.aria}
      >
        <Link
          href={localePath(locale, '/')}
          className="flex min-h-11 shrink-0 items-center gap-2"
          aria-label={copy.home}
        >
          <MenuMark
            className={cn(
              'transition-all duration-200',
              scrolled ? 'size-7' : 'size-8',
            )}
          />
          <span className="text-base font-semibold tracking-tight">
            OurFilm
          </span>
        </Link>

        <ul className="hidden flex-1 items-center justify-center gap-0.5 md:flex">
          {navLinks.map((link) =>
            link.menu ? (
              <li
                key={link.href}
                ref={menuRef}
                className="relative"
                onMouseEnter={() => setMenu(link.href)}
                onMouseLeave={() => setMenu(null)}
              >
                {/* A button, not a link with a panel hanging off it. It has
                    somewhere to go, but its job here is to open the list —
                    and a control that navigates on click while also opening
                    on hover fires both on a tap. The index is the last row
                    inside the panel instead. */}
                <button
                  type="button"
                  onClick={() => setMenu(menu === link.href ? null : link.href)}
                  aria-expanded={menu === link.href}
                  aria-controls={`nav-menu-${link.href.slice(1)}`}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-2 font-mono text-[10.5px] font-medium tracking-[0.14em] uppercase transition-colors',
                    menu === link.href
                      ? 'text-foreground'
                      : 'text-foreground/70 hover:text-foreground',
                  )}
                >
                  {link.label}
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      'size-3 transition-transform duration-200',
                      menu === link.href && 'rotate-180',
                    )}
                  />
                </button>

                <div
                  id={`nav-menu-${link.href.slice(1)}`}
                  className={cn(
                    'absolute top-full left-1/2 w-60 -translate-x-1/2 pt-2 transition-all duration-200',
                    menu === link.href
                      ? 'pointer-events-auto translate-y-0 opacity-100'
                      : 'pointer-events-none -translate-y-1 opacity-0',
                  )}
                  inert={menu !== link.href}
                >
                  <ul className="rounded-2xl border border-white/10 bg-[#0c0c0f] p-1.5 shadow-[0_24px_60px_-24px_rgba(0,0,0,.9)]">
                    {occasions.map((occasion) => (
                      <li key={occasion.slug}>
                        <Link
                          href={localePath(
                            locale,
                            `/alkalmak/${occasion.slug}`,
                          )}
                          onClick={() => setMenu(null)}
                          className="block rounded-xl px-3.5 py-2.5 font-display text-[15px] text-foreground/85 transition-colors hover:bg-white/6 hover:text-foreground"
                        >
                          {occasionCopy(locale, occasion).label}
                        </Link>
                      </li>
                    ))}
                    <li className="mt-1 border-t border-white/8 pt-1">
                      <Link
                        href={localePath(locale, link.href)}
                        onClick={() => setMenu(null)}
                        className="block rounded-xl px-3.5 py-2.5 font-mono text-[9.5px] font-medium tracking-[0.16em] text-foreground/50 uppercase transition-colors hover:text-foreground/80"
                      >
                        {locale === 'en' ? 'All occasions' : 'Minden alkalom'}
                      </Link>
                    </li>
                  </ul>
                </div>
              </li>
            ) : (
              <li key={link.href}>
                <Link
                  href={localePath(locale, link.href)}
                  className="rounded-full px-3 py-2 font-mono text-[10.5px] font-medium tracking-[0.14em] text-foreground/70 uppercase transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              </li>
            ),
          )}
        </ul>

        <Link
          href={`${LOGIN_PATH}?lang=${locale}`}
          className="hidden shrink-0 rounded-full px-3 py-2 font-mono text-[10.5px] font-medium tracking-[0.14em] text-foreground/70 uppercase transition-colors hover:text-foreground md:inline-flex"
        >
          {copy.login}
        </Link>

        <Link
          href={locale === 'en' ? '/hu' : '/en'}
          hrefLang={locale === 'en' ? 'hu' : 'en'}
          // Was `text-xs` sans while everything beside it was letterspaced
          // mono — three items on one side of a bar in three type treatments.
          className="hidden shrink-0 rounded-full px-2.5 py-2 font-mono text-[10.5px] font-medium tracking-[0.14em] text-foreground/45 transition-colors hover:text-foreground md:inline-flex"
        >
          {locale === 'en' ? 'HU' : 'EN'}
        </Link>

        <Link
          href={`${CREATE_EVENT_PATH}?lang=${locale}`}
          // Paper, not `bg-primary`: this is the same action as the hero's
          // primary button and the dashboard's `Új kamera`, and it is the one
          // material the pass gives to the thing that makes something.
          className="paper btn-shine hidden min-h-10 items-center rounded-full px-5 text-[12.5px] font-semibold md:inline-flex"
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
          // `transition-opacity`, never `transition-all`. With `all` the
          // browser watches every animatable property on a full-screen box
          // that carries a backdrop filter, and re-filters the whole page
          // behind it on every frame — which is what made this open in steps
          // on a phone rather than fade.
          // Scrolls, because six items plus four occasions plus the CTA is
          // taller than a small phone. `overscroll-contain` keeps a flick at
          // the end of the list from chaining to the page behind it.
          'fixed inset-0 z-40 flex flex-col overflow-y-auto overscroll-contain px-4 pt-24 pb-6',
          'transition-opacity duration-300 ease-out md:hidden',
          open
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0',
        )}
        // The panel stays mounted for the fade, so without `inert` its links
        // remain tab-focusable behind a closed menu.
        inert={!open}
      >
        {/* Tapping the dimmed area closes the menu, which is what anyone who
            has used a phone expects and one more way out of a panel that
            recently had none. A darker ground carries the contrast the
            lighter blur gives up. */}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => setOpen(false)}
          // `fixed`, not `absolute`: the panel is the scroll container now, and
          // an absolutely positioned backdrop resolves against its padding box
          // — so it would scroll up with the content and leave the bottom of
          // the screen unfiltered.
          className="fixed inset-0 -z-10 h-full w-full cursor-default bg-background/92 backdrop-blur-lg"
        />
        <div className="glass-strong flex flex-col gap-1 rounded-2xl p-4">
          {navLinks.map((link) => (
            <div key={link.href} className="contents">
              <Link
                href={localePath(locale, link.href)}
                onClick={() => setOpen(false)}
                className="rounded-2xl px-5 py-4 text-lg font-medium text-foreground/90 transition-colors hover:bg-white/5"
              >
                {link.label}
              </Link>
              {/* Nested rather than a second tap target that opens an
                  accordion. A phone menu has the whole screen; hiding four
                  rows behind a disclosure buys nothing and costs a tap. */}
              {link.menu
                ? occasions.map((occasion) => (
                    <Link
                      key={occasion.slug}
                      href={localePath(locale, `/alkalmak/${occasion.slug}`)}
                      onClick={() => setOpen(false)}
                      className="rounded-2xl py-2.5 pr-5 pl-9 font-display text-[16px] text-foreground/75 transition-colors hover:bg-white/5 hover:text-foreground"
                    >
                      {occasionCopy(locale, occasion).label}
                    </Link>
                  ))
                : null}
            </div>
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
