'use client'

import { QRCodeSVG } from 'qrcode.react'

import type { Locale } from '@/lib/i18n'
import { EXAMPLE_SLUG_SUFFIX, slugify } from '@/lib/slug'
import { eventUrl } from '@/lib/site'

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
  const url = eventUrl(`${slugify(name)}-${EXAMPLE_SLUG_SUFFIX}`, locale)

  return (
    <div className="paper w-full max-w-[330px] rotate-[-1.5deg] rounded-2xl p-6 text-center">
      <p className="paper-muted font-mono text-[8.5px] font-medium tracking-[0.2em]">
        {en ? 'OURFILM · DISPOSABLE CAMERA' : 'OURFILM · ELDOBHATÓ KAMERA'}
      </p>

      <p className="mt-3 font-display text-[26px] leading-[1.05] text-balance">
        {name}
      </p>

      <div className="mx-auto mt-5 w-fit rounded-sm bg-white p-3 shadow-[0_10px_34px_-16px_rgba(0,0,0,0.45)]">
        <QRCodeSVG
          value={url}
          size={168}
          level="M"
          bgColor="#ffffff"
          fgColor="#050505"
          marginSize={0}
        />
      </div>

      <p className="paper-muted mt-4 font-mono text-[9px] leading-snug tracking-[0.02em] break-all">
        {url.replace('https://', '')}
      </p>

      <div className="paper-rule mt-4 flex items-center justify-between border-t pt-3.5 font-mono text-[9px] font-medium tracking-[0.14em]">
        <span>{en ? '24 SHOTS' : '24 KÉP'}</span>
        <span className="paper-muted">{en ? 'NO APP' : 'NINCS APP'}</span>
      </div>
    </div>
  )
}
