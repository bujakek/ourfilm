import { Reveal } from './reveal'
import type { Locale } from '@/lib/i18n'
import { marketingCopy } from '@/lib/marketing-copy'

/**
 * Seven questions on ruled rows, with their answers showing.
 *
 * It was seven glass cards with a disclosure each, which meant seven taps to
 * read a page of text that is four hundred words long in total, and a `'use
 * client'` boundary for the privilege. The answers are short, the questions are
 * the ones every visitor has, and there is nothing here worth hiding — so
 * nothing is hidden, and the section is a Server Component again.
 *
 * The heading sits in its own column rather than centred above, so the rows
 * start at the top of the section instead of a third of the way down it.
 */
export function Faq({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].faq

  return (
    <section
      id="faq"
      className="relative border-t border-border px-4 py-22 sm:px-6 lg:px-10 lg:py-24"
    >
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <Reveal>
          <h2 className="font-display text-[34px] leading-[1.03] tracking-[-0.015em] text-balance sm:text-[44px]">
            {copy.title}
          </h2>
        </Reveal>

        <Reveal delay={80}>
          <dl>
            {copy.items.map(([question, answer]) => (
              <div
                key={question}
                className="border-b border-white/11 py-5 first:pt-0"
              >
                <dt className="text-[16.5px] leading-[1.4] font-medium text-foreground/90">
                  {question}
                </dt>
                <dd className="mt-2.5 max-w-[38rem] text-[14.5px] leading-relaxed text-pretty text-muted-foreground">
                  {answer}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  )
}
