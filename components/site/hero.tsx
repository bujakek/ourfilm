import Image from 'next/image'
import Link from 'next/link'

import type { Locale } from '@/lib/i18n'
import { marketingCopy } from '@/lib/marketing-copy'
import { CREATE_EVENT_PATH } from '@/lib/routes'
import { HeroTicket } from './hero-ticket'

/**
 * One photograph and one ticket.
 *
 * What stood here was four floating glass cards and a fake phone gallery — a
 * mockup of an app OurFilm deliberately does not have, assembled from the same
 * material as every other surface on the page. The product is a photograph you
 * do not get to see yet and a code on a piece of paper, so the hero is those
 * two things at the size they actually occur.
 *
 * The headline drops `text-gradient` / `text-gradient-accent` with the two
 * spans that carried them. A silver-to-grey gradient over a serif reads as a
 * 2014 hero, and the two-tone split was doing the work the italic now does
 * properly — emphasis on the one word the sentence turns on.
 */
export function Hero({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].hero

  return (
    <section
      id="top"
      className="relative flex min-h-[92vh] items-center overflow-hidden px-4 pt-32 pb-16 sm:px-6 lg:pt-36"
    >
      {/* One photograph, full bleed, behind a horizontal scrim. The image is
          the same `next/image` `fill` usage the old collage used; what changed
          is that there is one of them and it is behind the words rather than
          beside them. Desaturated and dimmed because it is a ground, not a
          subject — the ticket is the subject. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <Image
          src="/images/landing/hero-dance-crowd.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-28 grayscale-[.35]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#050505_12%,rgba(5,5,5,.72)_48%,rgba(5,5,5,.35)_100%)]" />
      </div>

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="reveal is-visible max-w-xl">
          {/* No glass pill and no dot: an eyebrow is a label, and it was
              wearing the same material as the cards beside it. */}
          <p className="font-mono text-[10px] font-medium tracking-[0.24em] text-accent">
            {copy.eyebrow}
          </p>

          <h1 className="mt-6 font-display text-[42px] leading-[0.98] tracking-[-0.02em] text-balance sm:text-[60px] xl:text-[76px]">
            {copy.titleStart}{' '}
            <Emphasised text={copy.titleEnd} word={copy.emphasis} />
          </h1>

          <p className="mt-7 max-w-lg text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
            {copy.lead}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href={`${CREATE_EVENT_PATH}?lang=${locale}`}
              className="paper btn-shine inline-flex items-center justify-center rounded-xl px-7.5 py-4.5 text-[15px] font-semibold transition-transform hover:scale-[1.03]"
            >
              {copy.create}
            </Link>
            <a
              href="#how-it-works"
              className="btn-shine inline-flex items-center justify-center rounded-xl border border-border-strong px-7.5 py-4.5 text-[15px] font-semibold transition-[transform,border-color] hover:scale-[1.03] hover:border-white/35"
            >
              {copy.how}
            </a>
          </div>

          {/* The helper line was one sentence about two of the four things
              that make this a disposable camera. All four are true and stated
              elsewhere; here they are the format, in the counting voice. */}
          <ul className="mt-7 flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-4 font-mono text-[9.5px] font-medium tracking-[0.14em] text-foreground/45">
            {copy.claims.map((claim, i) => (
              <li key={claim} className="flex items-center gap-3">
                {i > 0 ? (
                  // A middot rather than a left border. At 390px this row wraps
                  // to two lines, and a border draws a rule against the left
                  // margin of the second one — which reads as a table that has
                  // come apart. The separator has to belong to the pair, not to
                  // the cell.
                  <span aria-hidden="true" className="text-foreground/25">
                    ·
                  </span>
                ) : null}
                {claim}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-center lg:justify-end">
          <HeroTicket name={copy.couple} locale={locale} />
        </div>
      </div>
    </section>
  )
}

/**
 * Italicises one word inside translated copy.
 *
 * Split on the word rather than storing three fragments, so `titleEnd` stays a
 * whole sentence a translator can read and reorder. A word that is not found —
 * because the copy changed and `emphasis` did not — renders the sentence plain
 * rather than breaking it, which is the right failure for a headline.
 */
function Emphasised({ text, word }: { text: string; word: string }) {
  const at = text.indexOf(word)
  if (at === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <em className="italic">{word}</em>
      {text.slice(at + word.length)}
    </>
  )
}
