'use client'

import { EXAMPLE_SLUG_SUFFIX, slugify } from '@/lib/slug'
import { eventUrl } from '@/lib/site'
import { motion, useReducedMotion } from 'motion/react'
import { QRCodeSVG } from 'qrcode.react'
import { useMemo, useState } from 'react'
import { Reveal } from './reveal'

export function QrPreview() {
  const [name, setName] = useState('Anna & Péter')
  const reduceMotion = useReducedMotion()
  const slug = useMemo(() => `${slugify(name)}-${EXAMPLE_SLUG_SUFFIX}`, [name])
  const url = eventUrl(slug)
  const displayName = name.trim() || 'Az esemény neve'

  return (
    <section id="qr-code" className="relative px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
              EGYETLEN QR-KÓD
            </span>
            <h2 className="mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              A kamera már várja a vendégeket.
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-pretty text-muted-foreground">
              Tedd ki az asztalokra, a bejárathoz vagy a bárpulthoz. A vendégek
              beolvassák, és már fotózhatnak is.
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
              <div className="mt-4 flex min-w-0 items-center gap-2 text-sm">
                <span className="shrink-0 text-muted-foreground">Megosztható link:</span>
                <code className="glass min-w-0 truncate rounded-lg px-2.5 py-1 text-xs text-accent">
                  {url}
                </code>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                A saját eseményedhez egyedi QR-kódot és linket kapsz.
              </p>
            </div>
          </Reveal>

          <Reveal delay={120} className="flex justify-center">
            <div className="glass-strong w-full max-w-sm rounded-[2rem] p-3">
              <div className="rounded-[1.6rem] bg-gradient-to-b from-white to-[#f2f2f5] p-8 text-center text-black">
                <p className="text-2xl font-semibold tracking-tight text-balance">
                  {displayName}
                </p>
                <p className="mt-1 text-xs font-semibold tracking-[0.25em] text-black/50">
                  DIGITÁLIS ELDOBHATÓ KAMERA
                </p>

                <div className="my-7 flex justify-center">
                  <motion.div
                    key={url}
                    initial={reduceMotion ? false : { scale: 0.96 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: reduceMotion ? 'tween' : 'spring',
                      stiffness: 420,
                      damping: 24,
                    }}
                    className="rounded-2xl bg-white p-4 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.4)]"
                  >
                    <QRCodeSVG
                      value={url}
                      size={168}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#050505"
                    />
                  </motion.div>
                </div>

                <p className="mx-auto max-w-[15rem] text-sm leading-relaxed text-black/70">
                  Olvasd be a QR-kódot, és fotózd le az estét úgy, ahogy te
                  látod.
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
