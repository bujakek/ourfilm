import { Clock } from 'lucide-react'
import Image from 'next/image'
import { Reveal } from './reveal'

const photos = [
  {
    src: '/images/wedding-cake.webp',
    alt: 'Előhívás alatt álló esküvői fotó',
  },
  {
    src: '/images/guests-laughing.webp',
    alt: 'Előhívás alatt álló vendégfotó',
  },
  {
    src: '/images/evening-party.webp',
    alt: 'Előhívás alatt álló fotó az esti buliról',
  },
  {
    src: '/images/group-lookout.webp',
    alt: 'Előhívás alatt álló csoportkép',
  },
]

export function PhotoReveal() {
  return (
    <section id="photo-reveal" className="relative px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
              ELŐHÍVÁS
            </span>
            <h2 className="mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              A képek maradjanak meglepetések.
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-pretty text-muted-foreground">
              Te döntöd el, mikor nyíljon meg a galéria: azonnal, az esemény
              végén vagy néhány nappal később.
            </p>
          </Reveal>

          <Reveal delay={120} className="flex justify-center">
            <div className="glass-strong w-full max-w-[320px] rounded-[2.5rem] p-2.5">
              <div className="overflow-hidden rounded-[2rem] bg-background-secondary">
                <div className="flex items-center justify-between px-4 py-3.5">
                  <p className="text-sm font-semibold">Anna &amp; Péter</p>
                  <span className="flex items-center gap-1.5 text-[10px] text-accent">
                    <Clock className="size-3" aria-hidden="true" />
                    Előhívás alatt
                  </span>
                </div>

                <div className="relative">
                  <div className="grid grid-cols-2 gap-2 px-3 pb-4">
                    {photos.map((photo) => (
                      <div
                        key={photo.src}
                        className="relative aspect-square overflow-hidden rounded-xl"
                      >
                        <Image
                          src={photo.src}
                          alt={photo.alt}
                          fill
                          sizes="140px"
                          className="object-cover blur-sm brightness-[0.35]"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="absolute inset-0 flex items-center justify-center px-6 pb-4">
                    <div className="glass-strong rounded-2xl px-5 py-4 text-center">
                      <p className="text-sm font-semibold">
                        A képek még előhívás alatt vannak
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        A galéria az esemény végén nyílik meg.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
