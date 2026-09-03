import Image from 'next/image'
import Link from 'next/link'

import { CREATE_EVENT_PATH } from '@/lib/routes'
import { type Locale, localePath } from '@/lib/i18n'
import { marketingCopy } from '@/lib/marketing-copy'
import { Emphasised } from './emphasised'
import { Reveal } from './reveal'

/**
 * The last thing on the page, and the hero's answer.
 *
 * Four floating photographs and a QR watermark inside a `glass-strong` box
 * gave way to the same composition the hero uses: one photograph, full bleed,
 * under a scrim, with the words on top. That rhyme is the point — the page
 * opens and closes on the same image of the same evening, and the headline is
 * the hero's sentence turned into an instruction.
 *
 * The scrim runs vertically here rather than horizontally, because this block
 * is centred: it has to darken the top and bottom edges where text meets
 * photograph, not one side.
 */
export function FinalCta({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].final
  const hero = marketingCopy[locale].hero

  return (
    <section
      id="get-started"
      className="relative overflow-hidden px-4 py-24 sm:px-6 lg:py-30"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <Image
          src="/images/landing/final-dance-circle.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-22 grayscale-[.4]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#050505_0%,rgba(5,5,5,.6)_50%,#050505_100%)]" />
      </div>

      <Reveal className="relative mx-auto max-w-6xl text-center">
        <h2 className="mx-auto max-w-[24rem] font-display text-[38px] leading-[1.02] tracking-[-0.02em] text-balance sm:max-w-[30rem] sm:text-[56px]">
          {copy.titleStart}{' '}
          <Emphasised text={copy.titleEnd} word={hero.emphasis} />
        </h2>
        <p className="mx-auto mt-5.5 max-w-[30rem] text-[17px] leading-[1.6] text-pretty text-foreground/64">
          {copy.lead}
        </p>

        <div className="mt-8.5 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
          <Link
            href={`${CREATE_EVENT_PATH}?lang=${locale}`}
            className="paper btn-shine inline-flex items-center justify-center rounded-xl px-7.5 py-4.5 text-[15px] font-semibold transition-transform hover:scale-[1.03]"
          >
            {copy.create}
          </Link>
          <Link
            href={localePath(locale, '/arak')}
            className="inline-flex items-center justify-center rounded-xl border border-white/18 px-7.5 py-4.5 text-[15px] font-semibold text-foreground/85 transition-[transform,border-color] hover:scale-[1.03] hover:border-white/35"
          >
            {marketingCopy[locale].nav.links[2]}
          </Link>
        </div>

        {/* The same two claims the hero opens with, in the same voice. */}
        <p className="mt-5 font-mono text-[9.5px] font-medium tracking-[0.16em] text-foreground/40">
          {hero.claims.slice(0, 2).join(' · ')}
        </p>
      </Reveal>
    </section>
  )
}
