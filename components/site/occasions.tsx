'use client'

import { occasions } from '@/lib/occasions'
import { cn } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { Reveal } from './reveal'
import { type Locale, localePath } from '@/lib/i18n'

export function Occasions({ locale }: { locale: Locale }) {
  const [active, setActive] = useState(occasions[0].slug)
  const current = occasions.find((o) => o.slug === active) ?? occasions[0]

  return (
    <section id="occasions" className="relative px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Nem csak esküvőre
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            Születésnapon, közös utazáson vagy egy jól sikerült bulin ugyanígy
            működik: egy QR-kód, és a képek egy albumba kerülnek.
          </p>
        </Reveal>

        {/* Category selector */}
        <Reveal className="mt-10" delay={80}>
          <div className="flex flex-wrap gap-2">
            {occasions.map((o) => {
              const isActive = o.slug === active
              return (
                <button
                  key={o.slug}
                  type="button"
                  onClick={() => setActive(o.slug)}
                  aria-pressed={isActive}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-300',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'glass glass-hover text-muted-foreground hover:text-foreground',
                  )}
                >
                  <o.icon
                    className="size-4"
                    strokeWidth={1.7}
                    aria-hidden="true"
                  />
                  {o.label}
                </button>
              )
            })}
          </div>
        </Reveal>

        {/* Display */}
        <Reveal className="mt-8" delay={140}>
          <div className="glass-strong relative overflow-hidden rounded-[2rem] p-2">
            <div className="relative aspect-[16/10] overflow-hidden rounded-[1.6rem] sm:aspect-[16/8]">
              {occasions.map((o) => (
                <Image
                  key={o.slug}
                  src={o.image}
                  alt={o.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 1100px"
                  className={cn(
                    'object-cover transition-opacity duration-700 ease-out',
                    o.slug === active ? 'opacity-100' : 'opacity-0',
                  )}
                />
              ))}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
                <div key={current.slug} className="reveal is-visible max-w-xl">
                  <h3 className="text-2xl font-semibold text-balance sm:text-3xl">
                    {current.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-pretty text-foreground/80 sm:text-base">
                    {current.text}
                  </p>
                  <Link
                    href={localePath(locale, `/alkalmak/${current.slug}`)}
                    className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent transition-colors hover:text-foreground"
                  >
                    {current.label} — tudj meg többet
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
