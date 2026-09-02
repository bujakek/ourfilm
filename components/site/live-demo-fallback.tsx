'use client'

/**
 * The hardcoded simulation of a shared album.
 *
 * Only rendered when the real sample album cannot be read — see
 * `live-demo.tsx`. It stays honest about being a mockup, because it is one:
 * neither the upload button nor the download button does anything, and the
 * section says so above the frame.
 */

import { cn } from '@/lib/utils'
import { Check, Download, ImagePlus, Loader2, RotateCcw } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'
import { Reveal } from './reveal'
import { Button } from '@/components/ui/button'

const basePhotos = [
  { src: '/images/wedding-dance.webp', alt: 'Esküvői tánc' },
  { src: '/images/wedding-cake.webp', alt: 'Tortás pillanat' },
  { src: '/images/garden-party.webp', alt: 'Kerti buli fényfüzérekkel' },
  { src: '/images/group-lookout.webp', alt: 'Csoportkép a kilátónál' },
]

const newPhoto = {
  src: '/images/guests-laughing.webp',
  alt: 'Frissen feltöltött vendégfotó',
}

type Tab = 'vendeg' | 'hazigazda'

export function LiveDemoFallback() {
  const [tab, setTab] = useState<Tab>('vendeg')
  const [uploaded, setUploaded] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handleUpload = () => {
    if (uploaded || uploading) return
    setUploading(true)
    setTimeout(() => {
      setUploading(false)
      setUploaded(true)
    }, 1600)
  }

  const reset = () => {
    setUploaded(false)
    setUploading(false)
  }

  const photos = uploaded ? [newPhoto, ...basePhotos] : basePhotos

  return (
    <section id="live-demo" className="relative px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
            <span className="size-1.5 animate-pulse rounded-full bg-accent" />
            PRÓBÁLD KI
          </span>
          <h2 className="mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Próbáld ki vendégként
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            Tölts fel egy próbaképet, és nézd meg, milyen egyszerű csatlakozni.
          </p>
          <p className="mt-3 text-sm text-pretty text-muted-foreground">
            Ez csak egy bemutató, a kép nem kerül valódi eseménybe.
          </p>
        </Reveal>

        <Reveal className="mt-10" delay={100}>
          <div className="glass-strong overflow-hidden rounded-[2rem] p-2">
            {/* Gallery header */}
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-semibold">Közös album</p>
                <p className="text-xs text-muted-foreground">
                  {photos.length} fotó
                </p>
              </div>
              {/* Tabs */}
              <div className="glass flex rounded-full p-1">
                {(
                  [
                    { id: 'vendeg', label: 'Vendégként' },
                    { id: 'hazigazda', label: 'Házigazdaként' },
                  ] as { id: Tab; label: string }[]
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    aria-pressed={tab === t.id}
                    className={cn(
                      'rounded-full px-4 py-1.5 text-xs font-medium transition-colors sm:text-sm',
                      tab === t.id
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2 rounded-[1.6rem] bg-background-secondary/60 p-3 lg:grid-cols-[1.6fr_1fr]">
              {/* Gallery grid */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {photos.map((p, i) => (
                  <div
                    key={`${p.src}-${i}`}
                    className={cn(
                      'relative aspect-square overflow-hidden rounded-2xl',
                      uploaded &&
                        p.src === newPhoto.src &&
                        'ring-2 ring-accent',
                    )}
                  >
                    <Image
                      src={p.src}
                      alt={p.alt}
                      fill
                      sizes="(max-width: 640px) 45vw, 220px"
                      className="object-cover"
                    />
                    {uploaded && p.src === newPhoto.src && (
                      <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                        <Check className="size-3" aria-hidden="true" /> Most
                        érkezett
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Action panel */}
              <div className="glass flex flex-col rounded-2xl p-5">
                {tab === 'vendeg' ? (
                  <>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Válassz egy képet, és töltsd fel.
                    </p>
                    <div className="mt-auto pt-6">
                      <Button
                        type="button"
                        onClick={handleUpload}
                        disabled={uploading || uploaded}
                        variant={uploaded ? 'secondary' : 'default'}
                        className={cn(
                          'w-full',
                          uploaded ? 'border-accent/30 text-accent' : '',
                        )}
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />{' '}
                            Feltöltés…
                          </>
                        ) : uploaded ? (
                          <>
                            <Check className="size-4" aria-hidden="true" /> Fent
                            van a közös albumban
                          </>
                        ) : (
                          <>
                            <ImagePlus className="size-4" /> Próbakép feltöltése
                          </>
                        )}
                      </Button>
                      {uploaded && (
                        <button
                          type="button"
                          onClick={reset}
                          className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <RotateCcw className="size-3.5" /> Bemutató
                          visszaállítása
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Az összes feltöltött képet egyben letöltheted.
                    </p>
                    <div className="mt-auto space-y-3 pt-6">
                      <div className="glass flex items-center justify-between rounded-2xl px-4 py-3">
                        <span className="text-xs text-muted-foreground">
                          Album mérete
                        </span>
                        <span className="text-sm font-semibold">
                          {photos.length} fotó
                        </span>
                      </div>
                      <Button type="button" className="w-full">
                        <Download className="size-4" aria-hidden="true" /> Az
                        egész album letöltése
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
