import { Camera, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

import { SITE_CONTAINER, SITE_HEADING, SITE_KICKER } from './layout'

/**
 * Questions that open in place.
 *
 * Native `<details>`: the answers are in the HTML a crawler receives, and
 * Enter or Space on a focused question opens it with no script at all.
 */
export function SiteFaq({
  kicker,
  title,
  items,
}: {
  kicker: string
  title: string
  items: readonly (readonly [question: string, answer: string])[]
}) {
  return (
    <section
      className={cn(SITE_CONTAINER, 'pt-20 pb-[30px] tab:pt-25 tab:pb-15')}
    >
      <p className={cn(SITE_KICKER, 'mb-[22px] tab:mb-7')}>{kicker}</p>
      <h2 className={SITE_HEADING}>{title}</h2>
      <div className="mt-8 tab:mt-11">
        {items.map(([question, answer]) => (
          <details
            key={question}
            className="group mb-3 overflow-hidden rounded-[18px] border border-transparent open:border-site-line open:bg-landing-raised hover:bg-site-hover"
          >
            <summary className="flex min-h-[66px] cursor-pointer list-none items-center gap-3 rounded-[16px] px-2.5 py-[13px] focus-visible:outline-2 focus-visible:-outline-offset-3 focus-visible:outline-landing-link tab:gap-4 tab:p-4 [&::-webkit-details-marker]:hidden">
              <span className="grid size-8 shrink-0 place-items-center rounded-[10px] border border-site-line bg-white/5 tab:size-9">
                <Camera
                  aria-hidden="true"
                  className="size-[15px] text-white/35"
                  strokeWidth={1.6}
                />
              </span>
              <h3 className="flex-1 text-[16px] leading-[1.5] text-site-question group-open:text-white tab:text-[18px]">
                {question}
              </h3>
              <ChevronRight
                aria-hidden="true"
                className="size-3.5 shrink-0 text-white/35 transition-transform group-open:rotate-90 tab:size-[18px]"
              />
            </summary>
            <p className="max-w-[980px] px-5 pb-[22px] text-[15px] leading-[1.6] text-site-muted tab:px-[68px] tab:pb-6 tab:text-[16px]">
              {answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  )
}
