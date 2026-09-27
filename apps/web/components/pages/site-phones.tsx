import {
  ScreenCamera,
  ScreenReveal,
  ScreenTicket,
  type ScreenContent,
} from '@/components/site/phone-mock'
import { ScaledPhone } from '@/components/landing/scaled-phone'
import type { Locale } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export type SiteScreen = 'guest' | 'host' | 'setup'

/**
 * One product screen, filling the width it is given: the guest's camera, the
 * host's console, or the create flow's reveal question. They are the
 * homepage's mocks; nothing here draws a device of its own.
 */
export function SitePhone({
  locale,
  screen,
  content,
  maxScale = 1.4,
  className,
}: {
  locale: Locale
  screen: SiteScreen
  content?: ScreenContent
  maxScale?: number
  className?: string
}) {
  return (
    <ScaledPhone maxScale={maxScale} className={className}>
      {screen === 'guest' ? (
        <ScreenCamera locale={locale} {...content} />
      ) : screen === 'host' ? (
        <ScreenTicket locale={locale} {...content} />
      ) : (
        <ScreenReveal locale={locale} />
      )}
    </ScaledPhone>
  )
}

/** The guest's camera beside the host's console, the first a step lower. */
export function PhonePair({
  locale,
  content,
  className,
}: {
  locale: Locale
  content?: ScreenContent
  className?: string
}) {
  return (
    <div
      className={cn(
        'grid min-w-0 grid-cols-2 items-start gap-3 tab:gap-[18px]',
        className,
      )}
    >
      <SitePhone
        locale={locale}
        screen="guest"
        content={content}
        className="mt-6 tab:mt-[46px]"
      />
      <SitePhone locale={locale} screen="host" content={content} />
    </div>
  )
}
