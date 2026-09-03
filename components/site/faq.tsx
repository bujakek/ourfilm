'use client'

import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Reveal } from './reveal'
import type { Locale } from '@/lib/i18n'
import { marketingCopy } from '@/lib/marketing-copy'

/**
 * Seven questions on ruled rows.
 *
 * The rows still open, but they are rows now rather than seven glass cards
 * with a chevron each — the disclosure was never the problem, the material
 * was. A question and a rule is the lightest thing that can hold an answer,
 * and the heading moves into its own column so the list starts at the top of
 * the section instead of a third of the way down it.
 *
 * The plus rotates into a cross rather than swapping icons: it is the same
 * control in two states, and two icons crossfading would say it is two.
 */
export function Faq({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].faq
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section
      id="faq"
      className="relative border-t border-border px-4 py-22 sm:px-6 lg:px-10 lg:py-24"
    >
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <Reveal>
          <h2 className="font-display text-[34px] leading-[1.03] tracking-[-0.015em] text-balance sm:text-[44px]">
            {copy.title}
          </h2>
        </Reveal>

        <Reveal delay={80}>
          <ul>
            {copy.items.map(([question, answer], i) => {
              const isOpen = open === i
              const panelId = `faq-panel-${i}`
              const buttonId = `faq-button-${i}`
              return (
                <li key={question} className="border-b border-white/11">
                  <h3>
                    <button
                      type="button"
                      id={buttonId}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="flex w-full items-center justify-between gap-6 py-5 text-left"
                    >
                      <span className="text-[16.5px] leading-[1.4] font-medium text-foreground/90">
                        {question}
                      </span>
                      <Plus
                        className={cn(
                          'size-4 shrink-0 text-foreground/35 transition-transform duration-300',
                          isOpen && 'rotate-45',
                        )}
                        aria-hidden="true"
                      />
                    </button>
                  </h3>
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className={cn(
                      'grid transition-all duration-300 ease-out',
                      isOpen
                        ? 'grid-rows-[1fr] opacity-100'
                        : 'grid-rows-[0fr] opacity-0',
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="max-w-[38rem] pb-5 text-[14.5px] leading-relaxed text-pretty text-muted-foreground">
                        {answer}
                      </p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
