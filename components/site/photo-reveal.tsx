'use client'

import { motion, useInView, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import { useRef } from 'react'
import { Reveal } from './reveal'
import type { Locale } from '@/lib/i18n'
import { marketingCopy } from '@/lib/marketing-copy'
import { T, still } from '@/lib/motion'

/**
 * The reveal, as the states it actually has.
 *
 * The section used to be a fake phone gallery in a glass frame — a mockup of a
 * screen, beside a real one further up the page. What it is now is the answers
 * to the question the headline asks: a gallery that is open, one that is still
 * developing, and the album at the end of it.
 *
 * Three photographs, and the third needed a caption that `marketingCopy.reveal`
 * did not have — `reveal.download` is new here, and is the one string in this
 * section that has not been through a native pass.
 *
 * The developing card actually develops when it scrolls into view, on `T.develop`
 * — the same curve the product uses when a real frame arrives. It is the one
 * animation on the marketing page that is showing rather than decorating.
 */
export function PhotoReveal({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].reveal
  const demoRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const inView = useInView(demoRef, { once: true, amount: 0.55 })
  const developed = reduceMotion ? true : inView

  return (
    <section
      id="photo-reveal"
      className="relative px-4 py-24 sm:px-6 lg:px-10 lg:py-26"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-[34rem]">
          <p className="font-mono text-[10px] font-medium tracking-[0.24em] text-foreground/42">
            {copy.eyebrow}
          </p>
          <h2 className="mt-5 font-display text-[36px] leading-[1.02] tracking-[-0.015em] text-balance sm:text-[50px]">
            {copy.title}
          </h2>
          <p className="mt-5.5 text-[16.5px] leading-[1.65] text-pretty text-foreground/60">
            {copy.lead}
          </p>
        </Reveal>

        <div
          ref={demoRef}
          className="mt-14 grid gap-7 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Reveal>
            <figure>
              <div className="relative aspect-16/10 overflow-hidden rounded-sm">
                <Image
                  src="/images/landing/reveal-bride-friends.webp"
                  alt={
                    locale === 'en'
                      ? 'The bride celebrating with friends'
                      : 'A menyasszony a barátaival ünnepel'
                  }
                  fill
                  sizes="(max-width: 640px) 100vw, 540px"
                  className="object-cover"
                />
                <span className="absolute bottom-4 left-4 rounded-sm bg-background/55 px-2.5 py-1.5 font-mono text-[9px] font-medium tracking-[0.16em] text-accent">
                  {copy.opened}
                </span>
              </div>
              <figcaption className="mt-4 text-[14px] leading-[1.6] text-foreground/55">
                {copy.couple} · 42 {locale === 'en' ? 'photos' : 'kép'}
              </figcaption>
            </figure>
          </Reveal>

          <Reveal delay={90}>
            <figure>
              <div className="relative aspect-16/10 overflow-hidden rounded-sm">
                <motion.span
                  className="absolute inset-0 block"
                  initial={false}
                  animate={
                    developed
                      ? { filter: 'grayscale(0) brightness(1)' }
                      : { filter: 'grayscale(.7) brightness(.5)' }
                  }
                  transition={reduceMotion ? still : T.develop}
                >
                  <Image
                    src="/images/landing/reveal-couple-toast.webp"
                    alt={
                      locale === 'en'
                        ? 'The newlyweds sharing a drink'
                        : 'Az ifjú pár együtt koccint'
                    }
                    fill
                    sizes="(max-width: 640px) 100vw, 540px"
                    className="object-cover"
                  />
                </motion.span>
                <motion.span
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center"
                  initial={false}
                  animate={{ opacity: developed ? 0 : 1 }}
                  transition={reduceMotion ? still : T.settle}
                  aria-hidden={developed}
                >
                  <span className="font-mono text-[9px] font-medium tracking-[0.16em] text-accent">
                    {copy.developing}
                  </span>
                  <span className="font-display text-[20px] leading-[1.2] text-balance">
                    {copy.waiting}
                  </span>
                </motion.span>
              </div>
              <figcaption className="mt-4 text-[14px] leading-[1.6] text-foreground/55">
                {copy.waitingBody}
              </figcaption>
            </figure>
          </Reveal>

          <Reveal delay={180}>
            <figure>
              <div className="relative aspect-16/10 overflow-hidden rounded-sm">
                <Image
                  src="/images/landing/reveal-celebration.webp"
                  alt={
                    locale === 'en'
                      ? 'The newlyweds celebrating with their guests'
                      : 'Az ifjú pár a vendégekkel ünnepel'
                  }
                  fill
                  sizes="(max-width: 640px) 100vw, 380px"
                  className="object-cover"
                />
              </div>
              <figcaption className="mt-4 text-[14px] leading-[1.6] text-foreground/55">
                {copy.download}
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
