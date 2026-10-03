import { ScreenCamera, ScreenTicket } from '@/components/site/phone-mock'
import type { Locale } from '@/lib/i18n'
import { cn } from '@/lib/utils'

import { ScaledPhone } from './scaled-phone'

/**
 * The host's console and the guest's camera, side by side and staggered: the
 * pair the hero draws. Each phone is 47.5% of the box and the second sits 7%
 * lower, so the box is as tall as a phone plus that step — the aspect ratio
 * below is exactly that, and the caller only ever sets a width.
 */
export function PhoneDuo({
  locale,
  name,
  photos,
  maxScale,
  className,
}: {
  locale: Locale
  name: string
  photos?: readonly string[]
  maxScale: number
  className?: string
}) {
  return (
    <div className={cn('relative aspect-[1000/1062]', className)}>
      <ScaledPhone
        maxScale={maxScale}
        className="absolute top-0 left-0 w-[47.5%]"
      >
        <ScreenTicket locale={locale} name={name} photos={photos} />
      </ScaledPhone>
      <ScaledPhone
        maxScale={maxScale}
        className="absolute top-[7%] right-0 w-[47.5%]"
      >
        <ScreenCamera locale={locale} name={name} photos={photos} />
      </ScaledPhone>
    </div>
  )
}
