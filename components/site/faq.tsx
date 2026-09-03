import type { ReactNode } from 'react'
import { Reveal } from './reveal'
import type { Locale } from '@/lib/i18n'
import { marketingCopy } from '@/lib/marketing-copy'

/**
 * Seven questions, all of them answered in the open.
 *
 * Two earlier passes got this wrong in opposite directions. The first kept the
 * old accordion because the prototype's rows carry a `+`; but the prototype is
 * a static mock, and a `+` in a mock is how you draw a row, not a decision to
 * hide anything. The answers are two lines each — hiding four hundred words
 * behind seven taps buys nothing and costs a client component.
 *
 * So: a header with a count, a rule, and two columns of question and answer.
 * The questions are in the display serif, which is the one thing that keeps a
 * wall of prose scannable without a disclosure.
 */
export function Faq({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].faq
  // Split down the columns rather than across them, so reading order matches
  // what the eye does with two stacks of text.
  const half = Math.ceil(copy.items.length / 2)
  const columns = [copy.items.slice(0, half), copy.items.slice(half)]

  return (
    <section
      id="faq"
      className="relative border-t border-border px-4 py-20 sm:px-6 lg:px-10 lg:py-22"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="flex items-baseline justify-between gap-6 border-b border-white/11 pb-5">
            <h2 className="font-display text-[30px] leading-none tracking-[-0.015em] sm:text-[34px]">
              {copy.title}
            </h2>
            <p className="font-mono text-[10px] font-medium tracking-[0.16em] text-foreground/38">
              {String(copy.items.length).padStart(2, '0')} {copy.countLabel}
            </p>
          </div>
        </Reveal>

        <div className="grid gap-x-16 sm:grid-cols-2">
          {columns.map((column, c) => (
            <Reveal key={c} delay={c * 90}>
              <dl>
                {column.map(([question, answer], i) => (
                  <div
                    key={question}
                    className={`py-5.5 ${
                      i < column.length - 1 ? 'border-b border-white/11' : ''
                    }`}
                  >
                    <dt className="font-display text-[19px] leading-[1.25]">
                      {question}
                    </dt>
                    <dd className="mt-2.5 text-[14.5px] leading-[1.6] text-pretty text-muted-foreground">
                      <Figures text={answer} />
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/**
 * Sets the numbers in an answer in the counting voice.
 *
 * "Te választod ki: 5, 10, 16, 24 vagy 36 képet" is a list of roll lengths
 * wearing body copy, and every other number in the product — the frame
 * counter, the figure row, the price — is in the mono. Slightly smaller than
 * the surrounding text because Martian Mono runs wide, so matched by size it
 * would read as bold.
 */
function Figures({ text }: { text: string }): ReactNode {
  return text.split(/(\d+)/).map((part, i) =>
    /^\d+$/.test(part) ? (
      <span key={i} className="font-mono text-[0.92em] text-foreground/80">
        {part}
      </span>
    ) : (
      part
    ),
  )
}
