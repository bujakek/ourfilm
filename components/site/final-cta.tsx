import Image from 'next/image'
import Link from 'next/link'

import { CREATE_EVENT_PATH } from '@/lib/routes'
import { type Locale, localePath } from '@/lib/i18n'
import { marketingCopy } from '@/lib/marketing-copy'
import { Reveal } from './reveal'

/**
 * The last thing on the page.
 *
 * The photograph used to sit *behind* the words at 22% — a scrim over an
 * image doing neither job well. It moves below them instead, as a full-bleed
 * band of four frames at full strength: the words get a clean dark field, and
 * the photographs stop being wallpaper and become the thing being offered.
 * They are the four `final-*` images the old floating collage used, laid flat.
 *
 * The whole second line is italic here, where the hero italicises one word.
 * The hero's sentence turns on `vendégeitek`; this one is an instruction, and
 * the emphasis is the whole of what you would be looking at.
 */
export function FinalCta({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].final

  return (
    <section id="get-started" className="relative">
      <Reveal className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6 lg:py-28">
        <h2 className="mx-auto max-w-[26rem] font-display text-[38px] leading-[1.04] tracking-[-0.02em] text-balance sm:max-w-[34rem] sm:text-[56px]">
          {copy.titleStart} <em className="italic">{copy.titleEnd}</em>
        </h2>
        <p className="mx-auto mt-5.5 max-w-[34rem] text-[17px] leading-[1.6] text-pretty text-foreground/64">
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

        {/* `final.helper` in the counting voice. Derived rather than written
            out again, so the claim cannot drift from the sentence the pricing
            page and the hero also make. */}
        <p className="mt-5 font-mono text-[9.5px] font-medium tracking-[0.16em] text-foreground/40">
          {asReadout(copy.helper)}
        </p>
      </Reveal>

      <FinalStrip locale={locale} />
    </section>
  )
}

/** `Nincs app. Nincs vendégregisztráció.` → `NINCS APP · NINCS VENDÉGREGISZTRÁCIÓ` */
function asReadout(sentence: string): string {
  return sentence
    .toUpperCase()
    .replace(/\.\s*$/, '')
    .split(/\.\s+/)
    .join(' · ')
}

const STRIP = [
  {
    src: '/images/landing/final-rings.webp',
    alt: { en: 'The newlyweds showing their rings', hu: 'Az ifjú pár gyűrűi' },
  },
  {
    src: '/images/landing/final-wedding-dog.webp',
    alt: {
      en: 'A dog walking down the wedding aisle',
      hu: 'Kutya sétál végig az esküvői sorok között',
    },
  },
  {
    src: '/images/landing/final-couple-table.webp',
    alt: {
      en: 'A candid portrait of the newlyweds at their table',
      hu: 'Pillanatkép az ifjú párról az asztalnál',
    },
  },
  {
    src: '/images/landing/final-dance-circle.webp',
    alt: {
      en: 'Wedding guests cheering around the dance floor',
      hu: 'Esküvői vendégek ünnepelnek a táncparketten',
    },
  },
]

/**
 * Four frames, edge to edge, with no gap between them.
 *
 * A contact sheet rather than a gallery: the frames touch, because that is
 * what a strip of film does and what the host's dashboard rows already do.
 * Two across on a phone, where four would be 97px each.
 */
function FinalStrip({ locale }: { locale: Locale }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4">
      {STRIP.map((photo) => (
        <div key={photo.src} className="relative aspect-square">
          <Image
            src={photo.src}
            alt={photo.alt[locale]}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover"
          />
        </div>
      ))}
    </div>
  )
}
