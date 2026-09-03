import { Lock } from 'lucide-react'
import Image from 'next/image'
import { Reveal } from './reveal'
import type { Locale } from '@/lib/i18n'
import { marketingCopy } from '@/lib/marketing-copy'

/**
 * The reveal, as two states side by side.
 *
 * The section used to be a fake phone gallery in a glass frame — a mockup of a
 * screen, beside a real one further up the page. What it is now is the two
 * answers to the question the headline asks, and the whole point is that both
 * are on screen at once: a locked gallery next to an open one is an
 * explanation, where either alone is only a photograph.
 *
 * **Locked first, and it stays locked.** An earlier pass had the blurred card
 * resolve when it scrolled into view, on the same curve a real frame develops
 * on. That was a pleasant animation and the wrong idea — once it resolves both
 * cards say "open" and the comparison the section exists to make is gone. The
 * blur is a state, not a transition, which is also why nothing here needs to
 * be a client component any more.
 *
 * The pills carry `reveal.developing` and `reveal.opened`, the captions
 * `reveal.waitingBody` and the gallery's own line. Lilac is on the open one
 * only: an open gallery is the film being live, and the locked one is
 * precisely not that.
 */
export function PhotoReveal({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].reveal
  const en = locale === 'en'

  return (
    <section
      id="photo-reveal"
      className="relative px-4 py-24 sm:px-6 lg:px-10 lg:py-26"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="font-mono text-[10px] font-medium tracking-[0.24em] text-foreground/42">
            {copy.eyebrow}
          </p>
          <h2 className="mt-5 font-display text-[36px] leading-[1.02] tracking-[-0.015em] text-balance sm:text-[50px]">
            {copy.title}
          </h2>
          <p className="mt-5.5 max-w-[42rem] text-[16.5px] leading-[1.65] text-pretty text-foreground/60">
            {copy.lead}
          </p>
        </Reveal>

        <div className="mt-14 grid gap-7 sm:grid-cols-2">
          <Reveal>
            <figure>
              <div className="relative aspect-16/10 overflow-hidden rounded-sm">
                {/* Blurred in the markup rather than animated: this card *is*
                    the locked state, and a photograph you can almost read is
                    not one. `scale-105` because a blurred layer samples past
                    its own edge, so an unscaled image fades to transparent at
                    the corners and the card reads as a bug — the same reason
                    `reveal-preview.tsx` scales its blurred pair. */}
                <Image
                  src="/images/landing/reveal-couple-toast.webp"
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes="(max-width: 640px) 100vw, 540px"
                  className="scale-105 object-cover blur-[22px] brightness-[.55] grayscale"
                />
                <StatusPill label={copy.developing} />
              </div>
              <figcaption className="mt-4 text-[14.5px] leading-[1.6] text-foreground/55">
                {copy.waitingBody}
              </figcaption>
            </figure>
          </Reveal>

          <Reveal delay={90}>
            <figure>
              <div className="relative aspect-16/10 overflow-hidden rounded-sm">
                <Image
                  src="/images/landing/reveal-bride-friends.webp"
                  alt={
                    en
                      ? 'The bride celebrating with friends'
                      : 'A menyasszony a barátaival ünnepel'
                  }
                  fill
                  sizes="(max-width: 640px) 100vw, 540px"
                  className="object-cover"
                />
                <StatusPill label={copy.opened} live />
              </div>
              <figcaption className="mt-4 text-[14.5px] leading-[1.6] text-foreground/55">
                {copy.couple} · 42 {en ? 'photos' : 'kép'}
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/**
 * The state a gallery is in, drawn on the photograph it describes.
 *
 * A lilac dot or a lock rather than two arbitrary icons: the dot is the one
 * the guest screen and the host console already use for a live capture window,
 * and the lock is the only place in the product that has to say "not yet" as a
 * symbol rather than a sentence.
 */
function StatusPill({
  label,
  live = false,
}: {
  label: string
  live?: boolean
}) {
  return (
    <span
      className={`absolute bottom-5 left-5 inline-flex items-center gap-2.5 rounded-full border bg-background/55 px-3.5 py-2 font-mono text-[10px] font-medium tracking-[0.16em] ${
        live
          ? 'border-accent/40 text-accent'
          : 'border-white/20 text-foreground/85'
      }`}
    >
      {live ? (
        <span
          aria-hidden="true"
          className="size-[5px] rounded-full bg-accent"
        />
      ) : (
        <Lock className="size-3" strokeWidth={2} aria-hidden="true" />
      )}
      {label.toUpperCase()}
    </span>
  )
}
