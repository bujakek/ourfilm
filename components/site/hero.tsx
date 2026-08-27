import Image from 'next/image'
import Link from 'next/link'

import { CREATE_EVENT_PATH } from '@/lib/routes'
import { HeroQrDemo } from './hero-qr-demo'

const galleryImages = [
  {
    src: '/images/wedding-dance.webp',
    alt: 'Esküvői első tánc fényfüzérek alatt',
  },
  { src: '/images/wedding-cake.webp', alt: 'Tortavágás az esküvőn' },
  { src: '/images/guests-laughing.webp', alt: 'Nevető vendégek az asztalnál' },
  { src: '/images/garden-party.webp', alt: 'Esti kerti buli fényfüzérekkel' },
]

export function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-[92vh] items-center px-4 pt-32 pb-16 sm:px-6 lg:pt-36"
    >
      <div className="mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="reveal is-visible max-w-xl">
          <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-muted-foreground">
            <span className="size-1.5 rounded-full bg-accent" />
            Digitális eldobható fényképezőgép esküvőre
          </span>

          <h1 className="mt-6 text-[2rem] leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl xl:text-[3.5rem]">
            <span className="text-gradient">Az esküvőtök,</span>{' '}
            <span className="text-gradient-accent">
              ahogy a vendégeitek látták.
            </span>
          </h1>

          <p className="mt-7 max-w-lg text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
            A vendégek beolvassák a QR-kódot, megkapják a saját tekercsüket, és
            fotóznak. A képeket később együtt nézitek meg.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href={CREATE_EVENT_PATH}
              className="btn-shine inline-flex items-center justify-center rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
            >
              Hozd létre ingyen
            </Link>
            <a
              href="#how-it-works"
              className="glass glass-hover inline-flex items-center justify-center rounded-full px-7 py-3.5 text-sm font-semibold text-foreground"
            >
              Így működik
            </a>
          </div>

          <p className="mt-5 text-sm text-muted-foreground">
            Nincs app. Nincs vendégregisztráció.
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="relative aspect-[4/5] w-full">
            <div className="absolute top-1/2 left-1/2 w-[62%] max-w-[280px] -translate-x-1/2 -translate-y-1/2 animate-float-slow">
              <div className="glass-strong overflow-hidden rounded-[2.5rem] p-2.5">
                <div className="overflow-hidden rounded-[2rem] bg-background-secondary">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-[13px] leading-tight font-semibold">
                        Anna &amp; Péter
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Közös galéria
                      </p>
                    </div>
                    <span className="size-6 rounded-full bg-gradient-to-br from-accent to-accent-blue" />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 px-2.5 pb-3">
                    {galleryImages.map((img) => (
                      <div
                        key={img.src}
                        className="relative aspect-square overflow-hidden rounded-xl"
                      >
                        <Image
                          src={img.src}
                          alt={img.alt}
                          fill
                          sizes="140px"
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div
              className="absolute top-4 left-0 w-[38%] max-w-[150px] animate-float-slower [--rot:-6deg]"
              style={{ transform: 'rotate(-6deg)' }}
            >
              <div className="glass glass-hover overflow-hidden rounded-2xl p-1.5">
                <div className="relative aspect-[3/4] overflow-hidden rounded-xl">
                  <Image
                    src="/images/wedding-portrait.webp"
                    alt="Esküvői portré a párról"
                    fill
                    sizes="150px"
                    className="object-cover"
                  />
                </div>
              </div>
            </div>

            <div
              className="absolute right-0 bottom-6 w-[40%] max-w-[160px] animate-float-slow [--rot:7deg] [animation-delay:-4s]"
              style={{ transform: 'rotate(7deg)' }}
            >
              <div className="glass glass-hover overflow-hidden rounded-2xl p-1.5">
                <div className="relative aspect-square overflow-hidden rounded-xl">
                  <Image
                    src="/images/evening-party.webp"
                    alt="Esti fényfüzéres buli"
                    fill
                    sizes="160px"
                    className="object-cover"
                  />
                </div>
              </div>
            </div>

            <HeroQrDemo />
          </div>
        </div>
      </div>
    </section>
  )
}
