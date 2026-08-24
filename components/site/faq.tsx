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
 * - **Quality.** `lib/image.ts` re-encodes every upload in the browser to a
 *   4096px JPEG at q0.92 before it leaves the phone. That is a large,
 *   print-usable render — it is not the untouched original file, and EXIF does
 *   not survive the canvas. So: "nagy felbontású", never "eredeti minőség".
 * - **Moderation.** A host hides photos (`hidden_at`); single photos are never
 *   hard-deleted. Only the whole event can be deleted, so the answer offers
 *   exactly those two and never "törölheted a képet".
 * - **Visibility.** The album has no gate; anyone holding the link is in, and
 *   `gallery_hidden_at` is what decides whether guests may browse at all. The
 *   answer says both, and never says "biztonságos" or "jelszóval védett".
 */
const faqs = [
  {
    q: 'Kell a vendégeknek alkalmazást letölteniük?',
    a: 'Nem. A QR-kód beolvasása után az esemény a telefon böngészőjében nyílik meg, és a vendégek onnan töltenek fel.',
  },
  {
    q: 'Regisztrálniuk kell a vendégeknek?',
    a: 'Nem kell fiókot létrehozniuk vagy e-mail-címet megadniuk. A nevüket megadhatják, hogy a képek mellett látszódjon, kitől érkeztek.',
  },
  {
    q: 'Ki láthatja a feltöltött képeket?',
    a: 'A házigazda minden feltöltött fotót lát. A vendégek akkor nyithatják meg a közös albumot, ha a házigazda bekapcsolta a galériát, és rendelkeznek az esemény linkjével vagy QR-kódjával.',
  },
  {
    q: 'Milyen minőségben érkeznek meg a fotók?',
    a: 'A fotók nagy felbontásban, legfeljebb 4096 képpontos hosszabbik oldallal kerülnek az albumba, így nagyíthatók, vághatók és a legtöbb hétköznapi méretben ki is nyomtathatók. Nem a telefonon lévő eredeti fájl kerül fel, ezért egyes technikai metaadatok elveszhetnek.',
  },
  {
    q: 'Meddig érhetők el a képek?',
    a: 'A képek addig maradnak az esemény albumában, amíg házigazdaként nem törlöd az eseményt.',
  },
  {
    q: 'Moderálhatom, mi jelenjen meg az albumban?',
    a: 'Igen. Házigazdaként elrejtheted a nem kívánt képeket, és az egész eseményt a tartalmával együtt véglegesen törölheted.',
  },
  {
    q: 'Mennyibe kerül?',
    a: 'Az esemény létrehozása és az első 5 feltöltött kép ingyenes, bankkártya nélkül. A teljes esemény egyszeri 12 900 Ft, korlátlan vendéggel és korlátlan képpel. Nincs előfizetés, és a vendégek soha nem fizetnek semmit.',
  },
  {
    q: 'Hogyan kezelitek a feltöltött fotókat?',
    a: 'A fotókat az eseményalbum működtetéséhez tároljuk. Nem értékesítjük őket, és nem használjuk fel hirdetési célokra.',
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
