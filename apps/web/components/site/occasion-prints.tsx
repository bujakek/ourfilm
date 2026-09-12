import Image from 'next/image'
import Link from 'next/link'

import { type Locale, localePath } from '@/lib/i18n'
import { marketingCopy } from '@/lib/marketing-copy'
import { OCCASIONS_ARE_DRAFT, occasionCopy, occasions } from '@/lib/occasions'
import { Reveal } from './reveal'

/**
 * Four prints on a wall — what this camera is for, besides a wedding.
 *
 * The page up to here is a wedding product: the hero's eyebrow says so and the
 * headline addresses a couple. This is the one place that widens it, and the
 * argument for widening it visually rather than in a sentence is that a list
 * of occasions reads as a feature matrix while four photographs read as four
 * evenings.
 *
 * **`.paper`, because a print is the subject.** `globals.css` reserves that
 * material for exactly this — "what a surface wears when it is the subject" —
 * and it is already what the hero's ticket is made of. So the section costs no
 * new material: the same warm sheet, the same slight tilt off true, the same
 * deep shadow lifting it off the near-black.
 *
 * The photographs are desaturated so that four unrelated stock frames read as
 * one wall rather than four moods. That is art direction and nothing else —
 * the product returns exactly what the phone's camera gave it, at 3200px, and
 * `photo-quality.tsx` is where that claim lives.
 *
 * **Each print is a link while `OCCASIONS_ARE_DRAFT` is false, and a plain
 * figure while it is true.** Naming an occasion is a statement about what the
 * camera is for; linking one advertises a page, so it may only do that while
 * the page is genuinely part of the site — the same condition the navbar and
 * the sitemap read. Withdrawing the occasion pages therefore takes the links
 * off the homepage too, without leaving four dead prints behind.
 *
 * The caption is the whole of the visible link text, so the accessible name
 * comes from `linkLabel` instead — "Esküvő" tells a screen reader nothing
 * about where it goes, where "Vendégkamera esküvőre" does.
 */

/** Deterministic, not random: a fresh tilt per render is a print that twitches
 *  on every hydration, and `Math.random()` here would differ server to client. */
const TILT = [
  '-rotate-[1.6deg]',
  'rotate-[1.2deg]',
  'rotate-[0.9deg]',
  '-rotate-[1.3deg]',
]

export function OccasionPrints({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].occasions

  return (
    <section
      id="occasions"
      className="relative border-t border-border px-5 py-20 sm:px-6 lg:px-10 lg:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-[10px] font-medium tracking-[0.24em] text-accent">
            {copy.eyebrow}
          </p>
          <h2 className="mt-5 font-display text-[clamp(32px,7.5vw,52px)] leading-[1.02] tracking-[-0.015em] text-balance">
            {copy.title}
          </h2>
          <p className="mx-auto mt-5 max-w-[34rem] text-[16px] leading-[1.7] text-pretty text-foreground/60">
            {copy.lead}
          </p>
        </Reveal>

        {/* Two columns at 390px and four in one row from `lg` — the point is
            seeing them together as a wall, and four prints in a single column
            is a scroll while two columns on a desktop is a pair of posters.
            Prints alternate down rather than up: the offset is a margin on the
            even ones, never a negative margin on the odd ones, so nothing can
            ride up into the lead at a width nobody tested. */}
        <ul className="mt-12 grid grid-cols-2 gap-x-4 gap-y-7 sm:gap-x-10 sm:gap-y-10 lg:mt-16 lg:grid-cols-4 lg:gap-x-7">
          {occasions.map((occasion, i) => {
            // Localised here rather than in the map body's JSX: `occasion`
            // carries a Lucide component in `icon`, and nothing may hand one
            // of those to a Client Component. Only strings cross into
            // `Reveal`.
            const item = occasionCopy(locale, occasion)
            const print = (
              <figure
                className={`paper rounded-[4px] p-2.5 pb-0 ${TILT[i]} transition-transform duration-500 group-hover:rotate-0`}
              >
                {/* The ground under the photo is the film's own dark, so a
                    frame that has not loaded is a gap in the print rather
                    than a flash of white paper. */}
                <div className="film relative aspect-[4/5] overflow-hidden">
                  <Image
                    src={occasion.image}
                    alt={item.alt}
                    fill
                    sizes="(max-width: 640px) 44vw, (max-width: 1024px) 42vw, 240px"
                    className="object-cover grayscale transition-[filter] duration-500 group-hover:grayscale-0"
                  />
                </div>
                {/* The wide bottom edge is the whole reason a print reads as
                    a print, so the caption sits in it rather than under it. */}
                <figcaption className="px-1 pt-4 pb-5 text-center font-display text-[15px] leading-none sm:text-[17px]">
                  {item.label}
                </figcaption>
              </figure>
            )
            return (
              <Reveal
                as="li"
                key={occasion.slug}
                delay={i * 90}
                className={i % 2 === 0 ? 'mt-7 sm:mt-12' : ''}
              >
                {OCCASIONS_ARE_DRAFT ? (
                  <div className="group">{print}</div>
                ) : (
                  <Link
                    href={localePath(locale, `/alkalmak/${occasion.slug}`)}
                    aria-label={item.linkLabel}
                    className="group block rounded-[4px]"
                  >
                    {print}
                  </Link>
                )}
              </Reveal>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
