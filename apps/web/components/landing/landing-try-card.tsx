'use client'

import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState } from 'react'

import { MenuMark } from '@/components/brand/menu-mark'
import type { Locale } from '@/lib/i18n'
import { landingCopy } from '@/lib/landing-copy'
import { DEMO_EVENT_SLUG, demoEventUrl, eventUrl } from '@/lib/site'
import { cn } from '@/lib/utils'

/** How close to the bottom of the page the card steps aside, so it never
 *  sits on top of the footer or the closing phones. */
const BOTTOM_CLEARANCE = 1250

/**
 * A camera you can try by pointing a phone at the screen.
 *
 * Wide screens only: a phone visitor is already holding the device the code exists
 * to reach, and anything fixed to the bottom of a phone fights the browser's
 * own toolbar. The code is the live demo event, absolute because a phone
 * scanning a laptop is not on the laptop's origin.
 */
export function LandingTryCard({ locale }: { locale: Locale }) {
  const copy = landingCopy[locale].tryCard
  const [nearBottom, setNearBottom] = useState(false)

  useEffect(() => {
    const onScroll = () =>
      setNearBottom(
        window.scrollY + window.innerHeight >
          document.documentElement.scrollHeight - BOTTOM_CLEARANCE,
      )
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <Link
      href={demoEventUrl(locale)}
      aria-label={copy.aria}
      inert={nearBottom}
      className={cn(
        'fixed bottom-[85px] left-5 z-40 hidden w-[236px] flex-col items-center rounded-[32px] bg-white/10 p-[18px] backdrop-blur-[13px] transition-opacity duration-300 xl:flex [@media(max-height:720px)]:hidden',
        nearBottom && 'pointer-events-none opacity-0',
      )}
    >
      <span className="flex items-center gap-2 text-[13px] font-bold tracking-[0.24em] text-white">
        <MenuMark className="h-[15px] w-[13px]" />
        {copy.eyebrow}
      </span>
      {/* A viewfinder's four corners around the code. */}
      <span className="relative mt-4 flex w-full justify-center py-[10px]">
        {(
          [
            'top-0 left-0 border-t border-l rounded-tl-[6px]',
            'top-0 right-0 border-t border-r rounded-tr-[6px]',
            'bottom-0 left-0 border-b border-l rounded-bl-[6px]',
            'right-0 bottom-0 border-r border-b rounded-br-[6px]',
          ] as const
        ).map((corner) => (
          <span
            key={corner}
            aria-hidden="true"
            className={cn('absolute size-3 border-white/30', corner)}
          />
        ))}
        <span className="bg-white p-1">
          <QRCodeSVG
            value={eventUrl(DEMO_EVENT_SLUG)}
            size={112}
            level="M"
            bgColor="#ffffff"
            fgColor="#0d0d0d"
            marginSize={0}
          />
        </span>
      </span>
      <span className="mt-4 text-center text-[13px] leading-[1.4] text-white/50">
        {copy.lines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </span>
    </Link>
  )
}
