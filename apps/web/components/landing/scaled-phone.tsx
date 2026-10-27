'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

import { PhoneScaleContext } from '@/components/site/phone-mock'
import { cn } from '@/lib/utils'

/** `PhoneMock`'s own outer size. Every screen is drawn at exactly this. */
const PHONE_W = 254
const PHONE_H = 528

/**
 * A product screen drawn at whatever width its slot gives it.
 *
 * The screens are laid out in pixels at 254px, and redrawing them at every size
 * the homepage needs would be six copies of the same markup. So the phone is
 * rendered once at its own size and scaled to fill the width of this box.
 *
 * The ratio is measured rather than computed in CSS. The CSS-only version,
 * `scale: tan(atan2(100cqw, 254px))`, divided a container-query length by a
 * pixel length inside trig functions, and Safari resolves that to a negative
 * value — the phones came out rotated half a turn and mirrored. Until the
 * first measurement the screen is transparent (not `visibility: hidden`, which keeps Safari from loading the lazy photos inside it); it is decorative and `aria-hidden`,
 * and the box already holds its aspect ratio, so nothing around it moves.
 *
 * `maxScale` is the largest this box is ever drawn at; it only tells the
 * photos inside how many pixels to fetch.
 */
export function ScaledPhone({
  children,
  className,
  maxScale = 2,
}: {
  children: ReactNode
  className?: string
  maxScale?: number
}) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => {
      const width = el.offsetWidth
      if (width > 0) setScale(width / PHONE_W)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={box}
      aria-hidden="true"
      className={cn('relative aspect-[254/528] shrink-0', className)}
    >
      <div
        className="absolute top-0 left-0 origin-top-left text-left font-landing-sans text-white"
        style={{
          width: PHONE_W,
          height: PHONE_H,
          transform: scale === null ? undefined : `scale(${scale})`,
          opacity: scale === null ? 0 : undefined,
        }}
      >
        <PhoneScaleContext value={maxScale}>{children}</PhoneScaleContext>
      </div>
    </div>
  )
}
