import { cn } from '@/lib/utils'
import { CalendarPlus, Camera, Link2, QrCode } from 'lucide-react'
import Image from 'next/image'
import { SITE_HOST } from '@/lib/site'
import type { Locale } from '@/lib/i18n'
import { marketingCopy } from '@/lib/marketing-copy'
import { Reveal } from './reveal'

const visuals = [
  {
    number: '01',
    icon: CalendarPlus,
    image: '/images/landing/how-couple.webp',
    alt: {
      en: 'The newlyweds sharing a quiet moment at their table',
      hu: 'Az ifjú pár egy közös pillanata az asztalnál',
    },
    imageClassName: 'object-cover object-[center_35%]',
    note: null,
  },
  {
    number: '02',
    icon: QrCode,
    image: '/images/landing/how-cameras.webp',
    alt: {
      en: 'Disposable cameras set out for wedding guests',
      hu: 'A vendégeknek kikészített eldobható fényképezőgépek',
    },
    imageClassName: 'object-cover object-center',
    note: null,
  },
  {
    number: '03',
    icon: Camera,
    image: '/images/landing/how-guest-photo.webp',
    alt: {
      en: 'A wedding guest caught mid-dance',
      hu: 'Tánc közben elkapott esküvői vendég',
    },
    imageClassName: 'object-cover object-[center_40%]',
    note: null,
  },
]

export function HowItWorks({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].how
  const steps = visuals.map((visual, index) => ({
    ...visual,
    title: copy.steps[index][0],
    text: copy.steps[index][1],
  }))
  return (
    <section id="how-it-works" className="relative px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {copy.title}
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
                      <span className="glass flex size-12 items-center justify-center rounded-lg">
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
                  </div>

                  {/* Visual */}
                  <div className="lg:[direction:ltr]">
                    <div className="glass-strong overflow-hidden rounded-[2rem] p-2">
                      <div className="relative aspect-[4/3] overflow-hidden rounded-[1.6rem]">
                        <Image
                          src={step.image}
                          alt={step.alt[locale]}
                          fill
                          sizes="(max-width: 1024px) 100vw, 520px"
                          className={step.imageClassName}
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
                                {copy.tap}
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
