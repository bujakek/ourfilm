import type { Locale } from '@/lib/i18n'
import { marketingCopy } from '@/lib/marketing-copy'
import { Quote } from 'lucide-react'
import { Reveal } from './reveal'

/**
 * Three editorial testimonial cards, close to the rhythm of Once's review
 * section without borrowing its layout wholesale. Each story has the detail
 * that makes a short review feel grounded: a couple, a place and a date.
 */
export function Testimonials({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].testimonials

  return (
    <section
      id="testimonials"
      className="relative border-t border-border px-5 py-24 sm:px-6 lg:px-10 lg:py-26"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="max-w-[38rem]">
            <p className="font-mono text-[10px] font-medium tracking-[0.24em] text-foreground/42">
              {copy.eyebrow}
            </p>
            <h2 className="mt-5 font-display text-[clamp(34px,8vw,56px)] leading-[1.01] tracking-[-0.015em] text-balance">
              {copy.title}
            </h2>
          </div>
        </Reveal>

        {/* The same row pages horizontally on a phone and settles into three
            equal columns on desktop. Showing a slice of the next review is the
            affordance; no carousel controls or client JavaScript are needed. */}
        <div className="-mx-5 mt-14 flex snap-x snap-mandatory scrollbar-none gap-3.5 overflow-x-auto px-5 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:mt-16 lg:grid lg:grid-cols-3 lg:gap-5 lg:overflow-visible lg:px-0">
          {copy.reviews.map((review, i) => (
            <Reveal
              key={review.name}
              delay={i * 90}
              className="flex-[0_0_min(86vw,350px)] snap-center lg:min-w-0"
            >
              <figure className="flex h-full min-h-[390px] flex-col rounded-[22px] border border-white/9 bg-background-secondary p-6 sm:p-7">
                <div className="flex items-center justify-between gap-4">
                  <Quote
                    aria-hidden="true"
                    className="size-6 text-accent-silver/55"
                    strokeWidth={1.35}
                  />
                  <span className="font-mono text-[9px] font-medium tracking-[0.18em] text-foreground/34">
                    {review.date}
                  </span>
                </div>

                <h3 className="mt-9 font-display text-[27px] leading-[1.08] text-balance">
                  {review.title}
                </h3>
                <blockquote className="mt-5 flex-1 text-[15px] leading-[1.7] text-pretty text-foreground/66">
                  {locale === 'hu' ? `„${review.quote}”` : `“${review.quote}”`}
                </blockquote>

                <figcaption className="mt-8 border-t border-white/11 pt-5">
                  <span className="block text-[14px] font-semibold text-foreground/90">
                    {review.name}
                  </span>
                  <span className="mt-1 block font-mono text-[9.5px] font-medium tracking-[0.14em] text-foreground/38 uppercase">
                    {review.context}
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
