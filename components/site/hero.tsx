import Image from 'next/image'
import Link from 'next/link'

import type { Locale } from '@/lib/i18n'
import { marketingCopy } from '@/lib/marketing-copy'
import { CREATE_EVENT_PATH } from '@/lib/routes'
import { HeroQrDemo } from './hero-qr-demo'
import { buttonVariants } from '@/components/ui/button'

const galleryImages = [
  {
    src: '/images/landing/hero-dance-crowd.webp',
    alt: {
      en: 'A bride dancing in the middle of her guests',
      hu: 'Menyasszony táncol a vendégei között',
    },
  },
  {
    src: '/images/landing/hero-sunglasses-couple.webp',
    alt: {
      en: 'A wedding couple posing in sunglasses',
      hu: 'Napszemüvegben pózoló ifjú pár',
    },
  },
  {
    src: '/images/landing/hero-bride-party.webp',
    alt: {
      en: 'A bride celebrating on the dance floor',
      hu: 'Menyasszony ünnepel a táncparketten',
    },
  },
  {
    src: '/images/landing/hero-dance-floor.webp',
    alt: {
      en: 'Wedding guests piling onto the dance floor',
      hu: 'Vendégek a táncparkett közepén',
    },
  },
]

export function Hero({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].hero
  return (
    <section
      id="top"
      className="relative flex min-h-[92vh] items-center px-4 pt-32 pb-16 sm:px-6 lg:pt-36"
    >
      <div className="mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="reveal is-visible max-w-xl">
          <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-muted-foreground">
            <span className="size-1.5 rounded-full bg-accent" />
            {copy.eyebrow}
          </span>

          <h1 className="mt-6 text-[2rem] leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl xl:text-[3.5rem]">
            <span className="text-gradient">{copy.titleStart}</span>{' '}
            <span className="text-gradient-accent">{copy.titleEnd}</span>
          </h1>

          <p className="mt-7 max-w-lg text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
            {copy.lead}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href={`${CREATE_EVENT_PATH}?lang=${locale}`}
              className={buttonVariants()}
            >
              {copy.create}
            </Link>
            <a
              href="#how-it-works"
              className={buttonVariants({ variant: 'secondary' })}
            >
              {copy.how}
            </a>
          </div>

          <p className="mt-5 text-sm text-muted-foreground">{copy.helper}</p>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="relative aspect-[4/5] w-full">
            <div className="absolute top-1/2 left-1/2 w-[62%] max-w-[280px] -translate-x-1/2 -translate-y-1/2 animate-float-slow">
              <div className="glass-strong overflow-hidden rounded-[2.5rem] p-2.5">
                <div className="overflow-hidden rounded-[2rem] bg-background-secondary">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-[13px] leading-tight font-semibold">
                        {copy.couple}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {copy.gallery}
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
                          alt={img.alt[locale]}
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
                    src="/images/landing/hero-bride-portrait.webp"
                    alt={
                      locale === 'en'
                        ? 'A candid flash portrait of the bride'
                        : 'Vakus pillanatkép a menyasszonyról'
                    }
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
                    src="/images/landing/hero-couple-dance.webp"
                    alt={
                      locale === 'en'
                        ? 'A newlywed couple dancing among their guests'
                        : 'Az ifjú pár a vendégekkel táncol'
                    }
                    fill
                    sizes="160px"
                    className="object-cover"
                  />
                </div>
              </div>
            </div>

            <HeroQrDemo locale={locale} />
          </div>
        </div>
      </div>
    </section>
  )
}
