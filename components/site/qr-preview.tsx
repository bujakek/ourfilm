'use client'

import { EXAMPLE_SLUG_SUFFIX, slugify } from '@/lib/slug'
import { eventUrl } from '@/lib/site'
import { QRCodeSVG } from 'qrcode.react'
import { useMemo, useState } from 'react'
import { Reveal } from './reveal'

export function QrPreview() {
  const [name, setName] = useState('Anna & Péter')
  // A real event slug carries a random suffix (see generateEventSlug). Use a
  // fixed stand-in rather than generating one: this re-runs on every keystroke,
  // and a URL that reshuffles as you type is not a preview of anything. The
  // suffix has to be *shown* though — a mockup that omits it teaches hosts to
  // expect a shorter URL than the one they will actually be given.
  const slug = useMemo(() => `${slugify(name)}-${EXAMPLE_SLUG_SUFFIX}`, [name])
  const url = eventUrl(slug)
  const displayName = name.trim() || 'Az esemény neve'

  return (
    <section className="relative px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Copy + input */}
          <Reveal>
            <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
              QR-KÓD ELŐNÉZET
            </span>
            <h2 className="mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Nézd meg, mit olvasnak be a vendégeid
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-pretty text-muted-foreground">
              Írd be az esemény nevét, és nézd meg a QR-kártya előnézetét.
            </p>

            <div className="mt-8 max-w-md">
              <label
                htmlFor="event-name"
                className="mb-2 block text-sm font-medium text-muted-foreground"
              >
                Az esemény neve
              </label>
              <input
                id="event-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder="Anna & Péter"
                className="glass w-full rounded-2xl px-5 py-3.5 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground/60 focus:border-accent"
              />
              <div className="mt-4 flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">A generált link:</span>
                <code className="glass truncate rounded-lg px-2.5 py-1 text-xs text-accent">
                  {url}
                </code>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                A saját eseményedhez egyedi QR-kódot és megosztható
                meghívólinket kapsz.
              </p>
            </div>
          </Reveal>

          {/* Printable card */}
          <Reveal delay={120} className="flex justify-center">
            <div className="glass-strong w-full max-w-sm rounded-[2rem] p-3">
              <div className="rounded-[1.6rem] bg-gradient-to-b from-white to-[#f2f2f5] p-8 text-center text-black">
                <p className="text-2xl font-semibold tracking-tight text-balance">
                  {displayName}
                </p>
                <p className="mt-1 text-xs font-semibold tracking-[0.25em] text-black/50">
                  KÖZÖS FOTÓALBUM
                </p>

                <div className="my-7 flex justify-center">
                  <div className="rounded-2xl bg-white p-4 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.4)]">
                    <QRCodeSVG
                      value={url}
                      size={168}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#050505"
                    />
                  </div>
                </div>

                <p className="mx-auto max-w-[15rem] text-sm leading-relaxed text-black/70">
                  Olvasd be a QR-kódot, és töltsd fel a képeidet — app és
                  regisztráció nélkül.
                </p>
                <div className="mt-6 border-t border-black/10 pt-4">
                  <p className="truncate text-xs font-medium text-black/50">
                    {url.replace('https://', '')}
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
