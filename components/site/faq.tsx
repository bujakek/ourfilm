'use client'

import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Reveal } from './reveal'

/** Every answer is checked against the disposable-camera product as built. */
const faqs = [
  {
    q: 'Kell alkalmazást letölteni?',
    a: 'Nem. A QR-kód beolvasása után a kamera közvetlenül a telefon böngészőjében nyílik meg.',
  },
  {
    q: 'Kell regisztrálni?',
    a: 'A vendégeknek nem. Csak a nevüket adják meg, hogy mindenki a saját tekercsét használja.',
  },
  {
    q: 'Hogyan készülnek a képek?',
    a: 'A vendégek az OurFilm kamerájával, az esemény közben fotóznak. Nincs előnézet és nincs újrapróbálás.',
  },
  {
    q: 'Hány képet készíthet egy vendég?',
    a: 'Te választod ki: 5, 10, 16, 24 vagy 36 képet.',
  },
  {
    q: 'Mikor láthatók a képek?',
    a: 'Te döntöd el: azonnal, az esemény végén vagy 1–30 nappal később.',
  },
  {
    q: 'Ki láthatja a képeket?',
    a: 'A galéria nem nyilvános. Szervezőként minden képet látsz, a vendégek galériáját pedig te kapcsolod be.',
  },
  {
    q: 'Letölthetők a képek?',
    a: 'Igen. Az esemény képeit egyben is letöltheted, majd megoszthatod vagy kinyomtathatod őket.',
  },
]

export function Faq() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section id="faq" className="relative px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto max-w-3xl">
        <Reveal className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Gyakori kérdések
          </h2>
        </Reveal>

        <Reveal className="mt-12" delay={80}>
          <ul className="flex flex-col gap-3">
            {faqs.map((item, i) => {
              const isOpen = open === i
              const panelId = `faq-panel-${i}`
              const buttonId = `faq-button-${i}`
              return (
                <li key={item.q} className="glass overflow-hidden rounded-2xl">
                  <h3>
                    <button
                      type="button"
                      id={buttonId}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                    >
                      <span className="text-base font-medium sm:text-lg">
                        {item.q}
                      </span>
                      <Plus
                        className={cn(
                          'size-5 shrink-0 text-accent transition-transform duration-300',
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
                      'grid transition-all duration-400 ease-out',
                      isOpen
                        ? 'grid-rows-[1fr] opacity-100'
                        : 'grid-rows-[0fr] opacity-0',
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="px-6 pb-6 text-sm leading-relaxed text-pretty text-muted-foreground">
                        {item.a}
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
