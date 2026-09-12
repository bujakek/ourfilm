import { Download, Images, Printer, QrCode } from 'lucide-react'

import type { Locale } from '@/lib/i18n'
import { marketingCopy } from '@/lib/marketing-copy'
import { Reveal } from './reveal'

/** One per row of `problem.rows`, in that order. The left-hand phrase is the
 *  complaint, so the icon belongs to the answer beside it. */
const ICONS = [Images, Download, QrCode, Printer]

/**
 * The bridge from the wedding-day promise to the product flow, as four
 * corrections.
 *
 * It was a heading and one sentence in the page's usual asymmetric header —
 * true, and doing no work. The complaint the section exists to name is one
 * every reader has already lived through, and naming it costs a sentence each:
 * the phrase they recognise, struck out, and what happens instead. A visitor
 * who reads nothing else on the page can read four rows and know what this is.
 *
 * Centred rather than left-aligned, which on this page means something: the
 * hero and the closing CTA are centred statements and the explanatory sections
 * between them are not. This is a statement.
 *
 * **Every right-hand line is a live claim, not a flourish** — one album, the
 * ZIP download, no app, the print-ready master. See the landing-page promises
 * in `CLAUDE.md` before editing one. In particular the section's shape invites
 * "upload from your camera roll" and "unlimited photos", and neither is what
 * this product does.
 */
export function Problem({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].problem

  return (
    <section className="relative border-t border-border px-5 py-20 sm:px-6 lg:px-10 lg:py-24">
      <div className="mx-auto max-w-5xl">
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

        {/* One grid per row, re-ordered rather than rebuilt at `sm`.
            Phones get the icon once down the left with the pair stacked beside
            it, because two text columns at 390px would be two words a line in
            Hungarian. From `sm` the icon moves between them and the complaint
            turns right-aligned, so the pair reads across the rule. `order`
            drives grid auto-placement, so both layouts come out of one DOM
            order and neither is a copy of the other. */}
        <ul className="mt-12 lg:mt-16">
          {copy.rows.map(([before, after], i) => {
            const Icon = ICONS[i]
            return (
              <Reveal
                as="li"
                key={after}
                delay={i * 90}
                className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5 border-t border-white/11 py-5 last:border-b sm:grid-cols-[1fr_auto_1fr] sm:gap-x-7 sm:py-6"
              >
                <span
                  aria-hidden="true"
                  className="row-span-2 flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-background-secondary sm:order-2 sm:row-span-1 sm:size-11"
                >
                  <Icon className="size-4 text-accent" strokeWidth={1.6} />
                </span>

                {/* `<s>` rather than a strikethrough class: the line is copy
                    that is no longer accurate, and a reader who hears it
                    without seeing the rule through it hears a claim. */}
                <s className="text-[13.5px] leading-[1.4] text-pretty text-foreground/34 decoration-white/20 sm:order-1 sm:text-right sm:text-[15px]">
                  {before}
                </s>
                <p className="text-[15px] leading-[1.45] text-pretty text-foreground/90 sm:order-3 sm:text-[16.5px]">
                  {after}
                </p>
              </Reveal>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
