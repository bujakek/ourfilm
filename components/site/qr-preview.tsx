'use client'

import { EXAMPLE_SLUG_SUFFIX, slugify } from '@/lib/slug'
import { eventUrl } from '@/lib/site'
import { motion, useReducedMotion } from 'motion/react'
import { QRCodeSVG } from 'qrcode.react'
import { useMemo, useState } from 'react'
import { Reveal } from './reveal'
import type { Locale } from '@/lib/i18n'
import { marketingCopy } from '@/lib/marketing-copy'
import { T, still } from '@/lib/motion'

/**
 * The one light band on the page.
 *
 * Paper is the material of anything issued or printed, and this section is
 * about the one thing a host prints. Making the whole band paper — rather than
 * a paper card floating on the dark page — is what stops it reading as another
 * card in a column of cards. It is also why there is no `backdrop-filter`
 * anywhere on it: this band has to survive a screenshot and a laser printer
 * unchanged.
 *
 * **The live name field stays, and it is why this section is still here.** The
 * hero's ticket is static; this is the only place a visitor types their own
 * event name and watches the code redraw, which is the difference between
 * being told the QR is theirs and seeing it. The prototype puts a photograph
 * in the right column instead — the code is what the section is named for, so
 * the code is what stands there.
 */
export function QrPreview({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].qr
  const [name, setName] = useState(copy.placeholder)
  const reduceMotion = useReducedMotion()
  const slug = useMemo(() => `${slugify(name)}-${EXAMPLE_SLUG_SUFFIX}`, [name])
  const url = eventUrl(slug)
  const displayName = name.trim() || copy.fallback

  return (
    <section
      id="qr-code"
      className="paper relative overflow-x-clip rounded-none px-4 py-20 sm:px-6 lg:px-10 lg:py-22"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid min-w-0 items-center gap-14 lg:grid-cols-[1fr_0.82fr] lg:gap-20">
          <Reveal className="min-w-0">
            <p className="paper-muted font-mono text-[10px] font-medium tracking-[0.24em]">
              {copy.eyebrow}
            </p>
            <h2 className="mt-5 max-w-[22rem] font-display text-[36px] leading-[1.02] tracking-[-0.015em] text-balance sm:text-[50px]">
              {copy.title}
            </h2>
            <p className="paper-muted mt-5.5 max-w-[28rem] text-[16.5px] leading-[1.65] text-pretty">
              {copy.lead}
            </p>

            <div className="mt-8.5 flex max-w-[24rem] min-w-0 flex-col gap-3.5">
              <label
                htmlFor="event-name"
                className="paper-muted font-mono text-[9.5px] font-medium tracking-[0.16em]"
              >
                {copy.label}
              </label>
              {/* A rule on paper, like every other field in the product. */}
              <input
                id="event-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder={copy.placeholder}
                className="w-full min-w-0 border-b border-[rgba(20,19,18,.2)] bg-transparent pb-3 font-display text-[30px] leading-[1.1] text-[color:var(--paper-foreground)] outline-none placeholder:text-[rgba(20,19,18,.3)] focus:border-[rgba(20,19,18,.5)]"
              />
              {/* The address on its own line. Inline after the label it had
                  barely a word's width left and `break-all` was stranding the
                  slug's last character on a line of its own. */}
              <p className="paper-muted min-w-0 text-[13.5px]">
                {copy.link}
                <span className="mt-1 block font-mono text-[12.5px] break-all text-[rgba(20,19,18,.75)]">
                  {url.replace('https://', '')}
                </span>
              </p>
            </div>
          </Reveal>

          <Reveal delay={120} className="flex w-full min-w-0 justify-center">
            <motion.div
              key={url}
              initial={reduceMotion ? false : { scale: 0.96 }}
              animate={{ scale: 1 }}
              // The code re-keys as the visitor types their event name, so this
              // is a finger moving something: `snap`, not `settle`.
              transition={reduceMotion ? still : T.snap}
              className="w-full max-w-[300px] min-w-0 rounded-sm bg-white p-5 text-center shadow-[0_24px_60px_-28px_rgba(0,0,0,0.45)]"
            >
              <p className="max-w-full font-display text-[22px] leading-[1.1] [overflow-wrap:anywhere] text-[color:var(--paper-foreground)]">
                {displayName}
              </p>
              <p className="mt-1.5 font-mono text-[8.5px] font-medium tracking-[0.2em] text-[rgba(20,19,18,.45)]">
                {copy.cardLabel}
              </p>

              <div className="mt-5 flex min-w-0 justify-center">
                <QRCodeSVG
                  value={url}
                  size={196}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#050505"
                  className="h-auto w-full max-w-[196px]"
                />
              </div>

              <p className="mt-5 border-t border-[rgba(20,19,18,.12)] pt-3.5 font-mono text-[9px] leading-snug font-medium break-all text-[rgba(20,19,18,.5)]">
                {url.replace('https://', '')}
              </p>
            </motion.div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
