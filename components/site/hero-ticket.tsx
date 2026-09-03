'use client'

import { QRCodeSVG } from 'qrcode.react'

import type { Locale } from '@/lib/i18n'
import { marketingCopy } from '@/lib/marketing-copy'
import { EXAMPLE_SLUG_SUFFIX, slugify } from '@/lib/slug'
import { SITE_HOST, eventUrl } from '@/lib/site'

/**
 * The hero's one object: a ticket, at the size one gets printed.
 *
 * It replaces four floating glass cards and a fake phone gallery — a mockup of
 * an app this product deliberately does not have. What a host is actually
 * given is a code on a piece of paper, so that is what the hero shows.
 *
 * **The URL is derived, never written down.** `slugify()` and
 * `EXAMPLE_SLUG_SUFFIX` are the same helpers the live QR preview and the real
 * create flow use, so the shape a visitor sees here — readable stem plus a
 * random suffix — is the shape they will be given. A hardcoded string here
 * would eventually disagree with a printed card.
 *
 * Static, unlike `components/site/qr-preview.tsx`, which keeps its live name
 * field further down the page: that interaction is the best thing on the
 * marketing site and it should not be spent twice.
 */
export function HeroTicket({ name, locale }: { name: string; locale: Locale }) {
  const en = locale === 'en'
  const copy = marketingCopy[locale].qr
  const url = eventUrl(`${slugify(name)}-${EXAMPLE_SLUG_SUFFIX}`, locale)

  return (
    <div className="paper w-full max-w-[330px] rotate-[-1.5deg] rounded-lg px-7 pt-7.5 text-center">
      <p className="paper-muted font-mono text-[8.5px] font-medium tracking-[0.2em]">
        {en ? 'OURFILM · DISPOSABLE CAMERA' : 'OURFILM · ELDOBHATÓ KAMERA'}
      </p>

      <p className="mt-3.5 font-display text-[34px] leading-[1.04] text-balance">
        {name}
      </p>

      <div className="mx-auto mt-6 w-fit rounded-xs bg-white p-2.5 shadow-[0_12px_34px_-14px_rgba(0,0,0,0.35)]">
        <QRCodeSVG
          value={url}
          size={164}
          level="M"
          bgColor="#ffffff"
          fgColor="#050505"
          marginSize={0}
        />
      </div>

      {/* The sentence the printed sheet carries, from the same `qr` block the
          QR section uses — a ticket that only shows a code says nothing about
          what scanning it does. */}
      <p className="paper-muted mt-5 text-[13.5px] leading-[1.6] text-pretty">
        {copy.cardBody}
      </p>

      {/* The address is truncated here on purpose, unlike on the host's real
          ticket: this one is an illustration of the shape, and the live,
          typeable version is the QR section further down the page. */}
      <div className="paper-rule paper-muted mt-5 flex items-center justify-between border-t pt-3.5 pb-4.5 font-mono text-[9px] font-medium tracking-[0.14em]">
        <span>24 {en ? 'FRAMES' : 'KÉP'}</span>
        <span>{SITE_HOST.toUpperCase()}/E/…</span>
      </div>
    </div>
  )
}
