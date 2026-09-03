'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState } from 'react'

import type { Locale } from '@/lib/i18n'
import { marketingCopy } from '@/lib/marketing-copy'
import { T, still } from '@/lib/motion'
import { EXAMPLE_SLUG_SUFFIX, slugify } from '@/lib/slug'
import { eventUrl } from '@/lib/site'

/**
 * A camera you can try without reading anything.
 *
 * This is the one place the product can prove *nothing to download* without a
 * statistic: point a phone at the corner of the screen and the guest flow
 * opens. Every other claim on the page is a sentence asking to be believed.
 * That is what earns it a fixed position when nothing else on the site has one.
 *
 * Three rules it has to keep, and each one is a way it could go wrong:
 *
 * - **Not until the hero is behind you.** The hero has its own ticket with its
 *   own code on it; two QR codes on one screen is noise, and the second one
 *   arrives looking like an ad.
 * - **Never fixed on a phone.** `README.md` Phase 2 spends a page rejecting a
 *   fixed bottom deck on the guest screen, and the reasoning is not about that
 *   screen: on iOS the address bar sits at the bottom and re-expands on
 *   scroll-up, so anything pinned there is occluded or fighting for the same
 *   ~100px. A 266px card would be worse than the deck was. It is `hidden`
 *   below `md` and there is no mobile fallback, because a phone visitor is
 *   already holding the device the QR code exists to reach.
 * - **Dismissed stays dismissed** for the session. A card that returns on the
 *   next scroll is not a card, it is a pop-up.
 */
const DISMISSED_KEY = 'ourfilm:try-card-dismissed'

/** How far down the page the hero is reliably gone. The hero is `min-h-[92vh]`,
 *  so one viewport is past it on every screen it renders on. */
const HERO_CLEARED = () => window.innerHeight

export function TryCameraCard({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].card
  const reduceMotion = useReducedMotion()
  const [past, setPast] = useState(false)

  // Read in the initialiser rather than an effect, the same way
  // `lib/use-entrance.ts` does and for a version of the same reason: reading
  // storage during render is only safe when it cannot change the markup, and
  // here it cannot. `past` starts false on both sides, so the first paint is
  // `null` whatever this returns — the value is not consulted until a scroll
  // has already happened on the client.
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.sessionStorage.getItem(DISMISSED_KEY) !== null
    } catch {
      // Storage can be unavailable outright. Showing the card is the gentler
      // failure: it is the wrong answer only for someone who dismissed it.
      return false
    }
  })

  useEffect(() => {
    const onScroll = () => setPast(window.scrollY > HERO_CLEARED())
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  const dismiss = () => {
    setDismissed(true)
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // Storage can be refused outright. The card still closes for this view,
      // which is the part the reader asked for.
    }
  }

  const url = eventUrl(
    `${slugify('Anna & Péter')}-${EXAMPLE_SLUG_SUFFIX}`,
    locale,
  )

  return (
    <div className="pointer-events-none fixed right-7 bottom-7 z-40 hidden md:block">
      <AnimatePresence mode="wait" initial={false}>
        {past && !dismissed ? (
          <motion.div
            key="card"
            initial={{ opacity: 0, y: 16, rotate: -1.2 }}
            animate={{ opacity: 1, y: 0, rotate: -1.2 }}
            exit={{ opacity: 0, y: 8, rotate: -1.2 }}
            transition={reduceMotion ? still : T.settle}
            className="paper pointer-events-auto relative w-[266px] rounded-lg px-4.5 pt-4.5 pb-4"
          >
            <div className="flex items-start gap-3.5">
              <span className="block shrink-0 rounded-xs bg-white p-1.5 shadow-[0_8px_20px_-10px_rgba(0,0,0,0.3)]">
                <QRCodeSVG
                  value={url}
                  size={62}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#050505"
                  marginSize={0}
                />
              </span>
              <div className="min-w-0 pr-5">
                <p className="paper-muted font-mono text-[8px] font-medium tracking-[0.2em]">
                  {copy.eyebrow}
                </p>
                <p className="mt-1.5 font-display text-[19px] leading-[1.1]">
                  {copy.title}
                </p>
                <p className="paper-muted mt-1.5 text-[11.5px] leading-[1.45]">
                  {copy.lead}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={dismiss}
              aria-label={copy.dismiss}
              className="absolute top-2 right-2 flex size-[22px] items-center justify-center rounded-full bg-[rgba(20,19,18,.07)] text-[rgba(20,19,18,.5)] transition-colors hover:bg-[rgba(20,19,18,.14)]"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </motion.div>
        ) : past && dismissed ? (
          // Dismissing does not remove the offer, it folds it. The pill is
          // glass because a dismissed thing is inert, which is the one role
          // `.glass` still has.
          <motion.button
            key="pill"
            type="button"
            onClick={() => {
              setDismissed(false)
              try {
                window.sessionStorage.removeItem(DISMISSED_KEY)
              } catch {
                // See `dismiss` above.
              }
            }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={reduceMotion ? still : T.exit}
            className="glass pointer-events-auto rounded-full px-4 py-2.5 font-mono text-[9.5px] font-medium tracking-[0.16em] text-foreground/70 transition-colors hover:text-foreground"
          >
            {copy.reopen}
          </motion.button>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
