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
      className="relative border-t border-border px-5 py-24 sm:px-6 lg:px-10 lg:py-26"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
            <div>
              <p className="font-mono text-[10px] font-medium tracking-[0.24em] text-foreground/42">
                {en ? 'HOW IT WORKS' : 'HOGY MŰKÖDIK'}
              </p>
              <h2 className="mt-5 max-w-[26rem] font-display text-[clamp(32px,7.5vw,52px)] leading-[1.02] tracking-[-0.015em] text-balance">
                {copy.title}
              </h2>
            </div>
            <p className="max-w-[19rem] text-[15px] leading-[1.65] text-pretty text-foreground/55">
              {marketingCopy[locale].benefits.lead}
            </p>
          </div>
        </Reveal>

        {/* One layout for both cases, which is the point of doing it with
            scroll snapping rather than a breakpoint. Three cards across a
            desktop row are the same three cards a phone pages through one at a
            time, and `clamp(278px,31.5%,368px)` is what makes that true: on a
            phone the percentage collapses to the 278px floor, so a card and a
            slice of the next one sit on screen and the row reads as
            swipeable. Nothing here is a mobile variant of anything.

            Full-bleed on phones (`-mx-4`, restored by the cards' own padding)
            so the peeking card runs to the edge of the screen instead of
            stopping at a gutter, which is what makes it read as more content
            rather than a clipped one. */}
        <div className="-mx-5 mt-14 flex snap-x snap-mandatory scrollbar-none gap-3.5 overflow-x-auto px-5 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:mt-16 lg:gap-5 lg:px-0">
          {copy.steps.map(([title, text], i) => {
            const Screen = screens[i]
            return (
              <Reveal
                key={title}
                delay={i * 90}
                className="flex-[0_0_clamp(278px,31.5%,368px)] snap-center"
              >
                <div className="h-full rounded-[22px] border border-white/7 bg-[#0c0c0f] p-3 sm:p-4.5">
                  <div className="flex items-baseline gap-3 border-b border-white/10 px-1 pb-3">
                    <span className="font-mono text-[10px] font-medium tracking-[0.2em] text-accent">
                      {en ? 'STEP' : 'LÉPÉS'} {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>

                  <div className="mt-6 flex justify-center">
                    <Screen locale={locale} />
                  </div>

                  <h3 className="mt-7 px-1 font-display text-[26px] leading-[1.1]">
                    {title}
                  </h3>
                  <p className="mt-2.5 px-1 pb-1 text-[14px] leading-[1.55] text-pretty text-foreground/60">
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
