'use client'

import type { DemoAlbumPreview } from '@/lib/demo'
import { ArrowRight, QrCode } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { Reveal } from './reveal'

interface DemoAlbumProps {
  preview: DemoAlbumPreview
  /** Absolute URL — this is what the QR encodes, so it cannot be a path. */
  url: string
  /** Same album as a path, for client-side navigation from the button. */
  href: string
}

/**
 * The real sample album, rendered from rows actually in the database.
 *
 * A Client Component only because `qrcode.react` uses hooks; there is no state
 * of its own. Everything it renders arrives as props from `live-demo.tsx`.
 */
export function DemoAlbum({ preview, url, href }: DemoAlbumProps) {
  return (
    <section id="live-demo" className="relative px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
            <span className="size-1.5 animate-pulse rounded-full bg-accent" />
            PRÓBÁLD KI
          </span>
          <h2 className="mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Nézd meg, milyen egyszerű vendégként
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            Ez a mi bemutató albumunk, nem egy ügyfél eseménye — de ugyanazon a
            címen és ugyanazzal a felülettel nyílik meg, amit a vendégeid is
            látnak. Olvasd be a kódot a telefonoddal, vagy nyisd meg egy
            koppintással.
          </p>
        </Reveal>

        <Reveal className="mt-10" delay={100}>
          <div className="glass-strong overflow-hidden rounded-[2rem] p-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4">
              <p className="text-sm font-semibold">{preview.eventName}</p>
              <p className="text-xs text-muted-foreground">
                {preview.photoCount} fotó
              </p>
            </div>

            <div className="grid gap-2 rounded-[1.6rem] bg-background-secondary/60 p-3 lg:grid-cols-[1.6fr_1fr]">
              {/* Real thumbnails, straight from Storage */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {preview.photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative aspect-square overflow-hidden rounded-2xl"
                  >
                    <Image
                      src={photo.thumbUrl}
                      // Guest photos are compressed to spec client-side before
                      // upload, so re-optimising buys nothing and costs quota —
                      // see the note in next.config.mjs.
                      unoptimized
                      alt={
                        photo.uploaderName
                          ? `${photo.uploaderName} fotója a bemutató albumból`
                          : 'Fotó a bemutató albumból'
                      }
                      fill
                      sizes="(max-width: 640px) 45vw, 220px"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>

              {/* Open-it-yourself panel */}
              <div className="glass flex flex-col items-center rounded-2xl p-5 text-center">
                {/* Hidden on phones: a QR code on the screen you are holding is
                    not scannable by that same phone. The link below is. */}
                <div className="hidden sm:block">
                  <div className="rounded-2xl bg-white p-3">
                    <QRCodeSVG
                      value={url}
                      size={132}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#050505"
                    />
                  </div>
                  <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <QrCode className="size-3.5" aria-hidden="true" />
                    Olvasd be a telefonoddal
                  </p>
                </div>

                <p className="text-sm leading-relaxed text-pretty text-muted-foreground sm:mt-5">
                  Pontosan ezt látja egy vendég, amikor beolvassa a kártyát az
                  asztalon. A bemutató album csak megtekinthető — a sajátodba a
                  vendégeid app és regisztráció nélkül tölthetnek fel.
                </p>

                <Link
                  href={href}
                  className="btn-shine mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02] sm:mt-auto"
                >
                  Közös album megnyitása
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
