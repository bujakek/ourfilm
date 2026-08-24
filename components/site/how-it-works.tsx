import { cn } from '@/lib/utils'
import { CalendarPlus, Images, Link2, Lock, QrCode } from 'lucide-react'
import Image from 'next/image'
import { SITE_HOST } from '@/lib/site'
import { Reveal } from './reveal'

const steps = [
  {
    number: '01',
    icon: CalendarPlus,
    title: 'Hozd létre',
    text: 'Add meg az esemény nevét, és hozd létre a közös albumot.',
    image: '/images/wedding-portrait.webp',
    alt: 'Esküvői portré a párról',
    note: null,
  },
  {
    number: '02',
    icon: QrCode,
    title: 'Oszd meg',
    text: 'Tedd ki a QR-kódot, vagy küldd el a meghívólinket.',
    image: '/images/garden-party.webp',
    alt: 'Kerti buli fényfüzérek alatt',
    note: 'Az albumot az esemény linkjével vagy QR-kódjával lehet megnyitni, és az oldal nem jelenik meg a keresőkben.',
  },
  {
    number: '03',
    icon: Images,
    title: 'Kapd meg a képeket',
    text: 'A vendégek feltöltenek, te pedig minden fotót egy helyen találsz.',
    image: '/images/evening-party.webp',
    alt: 'Esti buli vendégekkel',
    note: null,
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Három lépés, és kész az album
          </h2>
        </Reveal>

        <div className="mt-16 flex flex-col gap-16 lg:gap-24">
          {steps.map((step, i) => {
            const reversed = i % 2 === 1
            return (
              <Reveal key={step.number}>
                <div
                  className={cn(
                    'grid items-center gap-8 lg:grid-cols-2 lg:gap-14',
                    reversed && 'lg:[direction:rtl]',
                  )}
                >
                  {/* Text */}
                  <div className="lg:[direction:ltr]">
                    <div className="flex items-center gap-4">
                      <span className="text-gradient text-5xl font-semibold tracking-tight">
                        {step.number}
                      </span>
                      <span className="glass flex size-12 items-center justify-center rounded-2xl">
                        <step.icon
                          className="size-6 text-accent"
                          strokeWidth={1.6}
                        />
                      </span>
                    </div>
                    <h3 className="mt-6 text-2xl font-semibold text-balance sm:text-3xl">
                      {step.title}
                    </h3>
                    <p className="mt-4 max-w-md leading-relaxed text-pretty text-muted-foreground">
                      {step.text}
                    </p>
                    {step.note && (
                      <div className="glass mt-6 flex max-w-md items-start gap-3 rounded-2xl p-4">
                        <Lock
                          className="mt-0.5 size-4 shrink-0 text-accent"
                          aria-hidden="true"
                        />
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {step.note}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Visual */}
                  <div className="lg:[direction:ltr]">
                    <div className="glass-strong overflow-hidden rounded-[2rem] p-2">
                      <div className="relative aspect-[4/3] overflow-hidden rounded-[1.6rem]">
                        <Image
                          src={step.image}
                          alt={step.alt}
                          fill
                          sizes="(max-width: 1024px) 100vw, 520px"
                          className="object-cover"
                        />
                        {i === 1 && (
                          <div className="glass-strong absolute bottom-4 left-4 flex items-center gap-3 rounded-2xl p-3">
                            <span className="flex size-14 items-center justify-center rounded-xl bg-white p-1.5">
                              <QrCode
                                className="size-full text-black"
                                strokeWidth={1.2}
                                aria-hidden="true"
                              />
                            </span>
                            <div className="pr-2">
                              <p className="flex items-center gap-1 text-xs font-semibold">
                                <Link2
                                  className="size-3 text-accent"
                                  aria-hidden="true"
                                />
                                {SITE_HOST}/e/…
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                Koppints a csatlakozáshoz
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
