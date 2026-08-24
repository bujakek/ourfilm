'use client'

import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Reveal } from './reveal'

/**
 * Every answer here is checked against what the product actually does, because
 * this is the page a host reads before deciding to trust it with a wedding.
 *
 * Two are worth the note:
 *
 * - **Moderation.** A host hides photos (`hidden_at`); single photos are never
 *   hard-deleted. Only the whole event can be deleted, so the answer speaks of
 *   what appears in the gallery and never of deleting one photo.
 * - **Visibility.** The album has no gate; anyone holding the link is in, and
 *   `gallery_hidden_at` is what decides whether guests may browse at all. The
 *   answer says both, and never says "biztonságos" or "jelszóval védett".
 */
const faqs = [
  {
    q: 'Kell alkalmazást letölteni?',
    a: 'Nem. A vendégeid a QR-kód beolvasása után közvetlenül a böngészőből tölthetnek fel.',
  },
  {
    q: 'Kell regisztrálni?',
    a: 'A vendégeknek nem. A nevüket megadhatják, hogy lásd, kitől érkeztek a képek.',
  },
  {
    q: 'Ki láthatja az albumot?',
    a: 'Az album nem nyilvános. Az esemény linkjével vagy QR-kódjával lehet megnyitni, a vendégeknek szánt galériát pedig te kapcsolhatod be.',
  },
  {
    q: 'Ki lehet nyomtatni a képeket?',
    a: 'Igen. A fotók jó minőségben kerülnek az albumba, így később le is töltheted és ki is nyomtathatod őket.',
  },
  {
    q: 'Meddig maradnak meg a képek?',
    a: 'Addig maradnak az albumodban, amíg nem törlöd az eseményt.',
  },
  {
    q: 'Elrejthetem a nem kívánt képeket?',
    a: 'Igen. Te döntöd el, mi jelenjen meg a vendégeknek szánt galériában.',
  },
  {
    q: 'Mennyibe kerül?',
    a: '5 fotóig ingyen, bankkártya nélkül kipróbálhatod. A teljes album egyszeri 12 900 Ft, korlátlan vendéggel és korlátlan fotóval.',
  },
  {
    q: 'Hogyan kezelitek a fotókat?',
    a: 'A képeidet nem adjuk el, és nem használjuk fel hirdetésekhez.',
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
