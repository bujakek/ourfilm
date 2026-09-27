'use client'

import type { ReactNode } from 'react'

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
 * rendered once at its own size and scaled to fill the width of this box —
 * the same idea as the design's phones, done in CSS so the server's markup is
 * already the right size and nothing jumps after hydration.
 *
 * The ratio is `100cqw / 254px`. CSS will not divide a length by a length, so
 * `tan(atan2(a, b))` does it: the angle is only there to turn `a / b` into a
 * plain number `scale` accepts.
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
  return (
    <div
      aria-hidden="true"
      className={cn('@container relative aspect-[254/528] shrink-0', className)}
    >
      <div
        className="absolute top-0 left-0 origin-top-left text-left font-sans text-foreground"
        style={{
          width: PHONE_W,
          height: PHONE_H,
          scale: `tan(atan2(100cqw, ${PHONE_W}px))`,
        }}
      >
        <PhoneScaleContext value={maxScale}>{children}</PhoneScaleContext>
      </div>
    </div>
  )
}
