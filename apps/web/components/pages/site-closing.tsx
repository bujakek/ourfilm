import Link from 'next/link'

import type { ScreenContent } from '@/components/site/phone-mock'
import type { Locale } from '@/lib/i18n'
import { CREATE_EVENT_PATH } from '@/lib/routes'
import { siteCopy } from '@/lib/site-copy'
import { cn } from '@/lib/utils'

import { SITE_BUTTON, SITE_CONTAINER, SITE_HEADING } from './layout'
import { PhonePair } from './site-phones'

/**
 * The last thing on every page: the homepage's closing line, the create
 * button, and a tilted pair of phones fading out below it.
 */
export function SiteClosing({
  locale,
  content,
}: {
  locale: Locale
  content?: ScreenContent
}) {
  const copy = siteCopy[locale]
  return (
    <section
      className={cn(
        SITE_CONTAINER,
        'relative mt-20 mb-[70px] flex max-h-[750px] flex-col gap-[50px] overflow-hidden pt-5 text-center tab:mt-25 tab:mb-[120px] tab:grid tab:max-h-[660px] tab:grid-cols-2 tab:items-center tab:gap-10 tab:pt-10 tab:text-left',
      )}
    >
      <div className="relative z-10 tab:pb-20">
        <h2 className={cn(SITE_HEADING, 'mb-7 tab:mb-[30px]')}>
          {copy.closing.titleLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h2>
        <Link
          href={`${CREATE_EVENT_PATH}?lang=${locale}`}
          className={SITE_BUTTON}
        >
          {copy.create}
        </Link>
        <p className="mt-4 text-[13px] text-site-muted tab:text-[14px]">
          {copy.closing.helper}
        </p>
      </div>
      <PhonePair
        locale={locale}
        content={content}
        className="mx-auto w-[95%] max-w-[430px] shrink-0 rotate-10 [mask-image:linear-gradient(#000_75%,transparent)] tab:mx-0 tab:w-full tab:max-w-none"
      />
    </section>
  )
}
