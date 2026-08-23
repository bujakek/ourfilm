import { QrCode } from 'lucide-react'
import Image from 'next/image'
import { Reveal } from './reveal'
import Link from 'next/link'

const floatingPhotos = [
  {
    src: '/images/wedding-dance.webp',
    alt: 'Esküvői tánc',
    className: 'left-[4%] top-[18%] w-24 rotate-[-8deg] sm:w-28',
  },
  {
    src: '/images/birthday.webp',
    alt: 'Születésnap',
    className: 'right-[6%] top-[12%] w-24 rotate-[7deg] sm:w-32',
  },
  {
    src: '/images/group-lookout.webp',
    alt: 'Csoportkép',
    className: 'left-[8%] bottom-[14%] w-24 rotate-[6deg] sm:w-28',
  },
  {
    src: '/images/garden-party.webp',
    alt: 'Kerti buli',
    className: 'right-[5%] bottom-[16%] w-24 rotate-[-6deg] sm:w-32',
  },
]

export function FinalCta() {
  return (
    <section id="get-started" className="relative px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="glass-strong relative overflow-hidden rounded-[2.5rem] px-6 py-20 text-center sm:px-10 sm:py-28">
            {/* glow + qr motif */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
            >
              <div className="absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(150,120,255,0.22),transparent_70%)] blur-3xl" />
              <QrCode
                className="absolute top-1/2 left-1/2 size-[26rem] -translate-x-1/2 -translate-y-1/2 text-white/[0.03]"
                strokeWidth={0.5}
              />
            </div>

            {/* floating photos (hidden on small screens to avoid overflow) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 hidden sm:block"
            >
              {floatingPhotos.map((p, i) => (
                <div
                  key={p.src}
                  className={`glass absolute animate-float-slow overflow-hidden rounded-2xl p-1 ${p.className}`}
                  style={{ animationDelay: `${i * -3}s` }}
                >
                  <div className="relative aspect-[3/4] overflow-hidden rounded-xl">
                    <Image
                      src={p.src}
                      alt={p.alt}
                      fill
                      sizes="128px"
                      className="object-cover"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                <span className="text-gradient">Egy esemény.</span>{' '}
                <span className="text-gradient-accent">Minden szemszög.</span>{' '}
                <span className="text-gradient">Egy album.</span>
              </h2>
              <p className="mx-auto mt-6 max-w-lg leading-relaxed text-pretty text-muted-foreground">
                Hozd létre a közös albumot, oszd meg a QR-kódot, és hagyd, hogy
                a vendégeid is elmeséljék az eseményt.
              </p>
              <div className="mt-9 flex justify-center">
                <Link
                  href="/admin/login"
                  className="btn-shine inline-flex items-center justify-center rounded-full bg-primary px-8 py-4 text-base font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
                >
                  Ingyenes esemény létrehozása
                </Link>
              </div>
              <p className="mt-5 text-sm text-muted-foreground">
                Bankkártya nélkül kipróbálható.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
