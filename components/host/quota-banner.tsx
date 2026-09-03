'use client'

import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import type { EventQuota } from '@/lib/billing'
import { T, still } from '@/lib/motion'
import { eventPriceLabel } from '@/lib/pricing'

/**
 * The free tier's edge, seen from the host's side.
 *
 * Unlike the guest's version of this message, the host is the person who can
 * act on it — so this one ends in a price and a button rather than a shrug.
 * The button goes to the billing card rather than straight to Stripe on
 * purpose: `startEventCheckout` requires the consumer-law acceptance, and that
 * checkbox is where it is shown.
 *
 * It is the one element in the product allowed to interrupt, and it earns that
 * by arriving in two beats. The row drops 10px on `settle`; its red border and
 * fill arrive 240ms later, once the geometry has settled. A host registers a
 * new row first and its severity second, rather than a red flash he has to
 * read backwards. The red is a layer fading in over the neutral row instead of
 * a `backgroundColor` animation, because both shades are theme variables and
 * only opacity interpolates reliably between them.
 */
const SEVERITY_DELAY_MS = 240

export function QuotaBanner({
  slug,
  quota,
  locale,
}: {
  slug: string
  quota: EventQuota
  locale: 'en' | 'hu'
}) {
  const full = quota.participantCount >= quota.participantLimit
  const en = locale === 'en'
  const reduceMotion = useReducedMotion()

  const [severe, setSevere] = useState(false)
  useEffect(() => {
    if (!full) return
    if (reduceMotion) {
      // Reduce Motion collapses the durations, not the sequence — but a
      // second beat with no motion in it is just a late flash, so here the
      // two arrive together.
      const id = setTimeout(() => setSevere(true), 0)
      return () => clearTimeout(id)
    }
    // A timeout rather than an animation callback: `onAnimationComplete` does
    // not fire in a backgrounded tab, and this one runs on a laptop that is
    // left open on another desktop for hours.
    const id = setTimeout(() => setSevere(true), SEVERITY_DELAY_MS)
    return () => clearTimeout(id)
  }, [full, reduceMotion])

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? still : T.settle}
      className="print-hidden relative mt-4.5 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-white/3 px-4.5 py-3.5"
    >
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-px rounded-lg border border-destructive/30 bg-destructive/8"
        initial={false}
        animate={{ opacity: severe ? 1 : 0 }}
        transition={reduceMotion ? still : T.settle}
      />

      <div className="relative min-w-0">
        <p
          className={`text-[13.5px] font-semibold transition-colors ${
            severe ? 'text-destructive' : ''
          }`}
        >
          {full
            ? en
              ? 'New guests cannot join'
              : 'Új vendégek nem tudnak csatlakozni'
            : en
              ? 'Free event'
              : 'Ingyenes esemény'}
        </p>
        <p className="mt-1 text-[12.5px] leading-[1.5] text-muted-foreground">
          {full
            ? en
              ? `The free allowance filled up at ${quota.participantLimit} guests. Everyone already in can keep shooting.`
              : `Az ingyenes keret ${quota.participantLimit} vendégnél betelt. A már csatlakozottak tovább fotózhatnak.`
            : en
              ? `Up to ${quota.participantLimit} guests are free on this event.`
              : `Ezen az eseményen ${quota.participantLimit} vendégig ingyenes.`}
        </p>
      </div>
      <Link
        href={`/host/events/${slug}/settings?lang=${locale}#billing`}
        className="relative shrink-0 rounded-full bg-primary px-4.5 py-2.5 text-[12.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        {en ? 'Unlock' : 'Feloldás'} — {eventPriceLabel(locale)}
      </Link>
    </motion.div>
  )
}
