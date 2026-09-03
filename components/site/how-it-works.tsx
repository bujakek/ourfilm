import type { Locale } from '@/lib/i18n'
import { marketingCopy } from '@/lib/marketing-copy'
import { Reveal } from './reveal'
import { ScreenCamera, ScreenReveal, ScreenTicket } from './phone-mock'

/**
 * Three steps, each showing the screen it happens on.
 *
 * What stood here was three photographs of a wedding with a caption beside
 * each — pictures of the occasion, which a visitor can already picture
 * perfectly well, and nothing whatsoever of the product. A visitor deciding
 * whether to use this has one question the old section could not answer: what
 * does it actually look like. So the photographs give way to the real screens.
 *
 * The heading takes `benefits.lead` as its supporting line, which is why the
 * benefits section no longer renders: it was one heading and one sentence, the
 * heading is word-for-word `footer.tagline`, and the sentence belongs to this
 * section's promise rather than to a section of its own.
 */
export function HowItWorks({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].how
  const en = locale === 'en'
  const screens = [ScreenReveal, ScreenTicket, ScreenCamera]

  return (
    <section
      id="how-it-works"
      className="relative border-t border-border px-4 py-24 sm:px-6 lg:px-10 lg:py-26"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
            <div>
              <p className="font-mono text-[10px] font-medium tracking-[0.24em] text-foreground/42">
                {en ? 'HOW IT WORKS' : 'HOGY MŰKÖDIK'}
              </p>
              <h2 className="mt-5 max-w-[26rem] font-display text-[36px] leading-[1.02] tracking-[-0.015em] text-balance sm:text-[52px]">
                {copy.title}
              </h2>
            </div>
            <p className="max-w-[19rem] text-[15px] leading-[1.65] text-pretty text-foreground/55">
              {marketingCopy[locale].benefits.lead}
            </p>
          </div>
        </Reveal>

        {/* `grid-cols-3` is already `repeat(3,minmax(0,1fr))` in Tailwind v4,
            so the columns were never the thing that overflowed — a fixed 254px
            phone in a 56px-gutter row simply needs more width than the
            breakpoint hands it just after `lg`. The gutter now shrinks with the
            viewport instead of holding at 56px, the row is capped at the width
            three phones and their gutters actually want, and the phones are
            centred in their columns rather than left in them. */}
        <div className="mx-auto mt-14 grid max-w-[1120px] justify-items-center gap-[clamp(20px,3vw,56px)] lg:mt-16 lg:grid-cols-3">
          {copy.steps.map(([title, text], i) => {
            const Screen = screens[i]
            return (
              <Reveal key={title} delay={i * 90}>
                <div>
                  <div className="flex items-baseline gap-3 border-b border-white/14 pb-3.5">
                    <span className="font-mono text-[10px] font-medium tracking-[0.2em] text-accent">
                      {en ? 'STEP' : 'LÉPÉS'} {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>

                  <div className="mt-8 flex justify-center">
                    <Screen locale={locale} />
                  </div>

                  <h3 className="mt-8.5 font-display text-[27px] leading-[1.1]">
                    {title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-[1.6] text-pretty text-foreground/60">
                    {text}
                  </p>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
