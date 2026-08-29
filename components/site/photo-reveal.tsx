'use client'

import { Check, Clock } from 'lucide-react'
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from 'motion/react'
import Image from 'next/image'
import { useRef } from 'react'
import { Reveal } from './reveal'
import type { Locale } from '@/lib/i18n'
import { marketingCopy } from '@/lib/marketing-copy'

const photos = [
  {
    src: '/images/wedding-cake.webp',
    alt: {
      en: 'A wedding photo being revealed',
      hu: 'Előhívás alatt álló esküvői fotó',
    },
  },
  {
    src: '/images/guests-laughing.webp',
    alt: {
      en: 'A guest photo being revealed',
      hu: 'Előhívás alatt álló vendégfotó',
    },
  },
  {
    src: '/images/evening-party.webp',
    alt: {
      en: 'An evening party photo being revealed',
      hu: 'Előhívás alatt álló fotó az esti buliról',
    },
  },
  {
    src: '/images/group-lookout.webp',
    alt: {
      en: 'A group photo being revealed',
      hu: 'Előhívás alatt álló csoportkép',
    },
  },
]

export function PhotoReveal({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].reveal
  const demoRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const inView = useInView(demoRef, { once: true, amount: 0.65 })
  const developed = reduceMotion ? true : inView

  return (
    <section id="photo-reveal" className="relative px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
              {copy.eyebrow}
            </span>
            <h2 className="mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {copy.title}
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-pretty text-muted-foreground">
              {copy.lead}
            </p>
          </Reveal>

          <Reveal delay={120} className="flex justify-center">
            <div
              ref={demoRef}
              className="glass-strong w-full max-w-[320px] rounded-[2.5rem] p-2.5"
            >
              <div className="overflow-hidden rounded-[2rem] bg-background-secondary">
                <div className="flex items-center justify-between px-4 py-3.5">
                  <p className="text-sm font-semibold">{copy.couple}</p>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={developed ? 'ready' : 'developing'}
                      initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                      transition={{ duration: reduceMotion ? 0 : 0.18 }}
                      className="flex items-center gap-1.5 text-[10px] text-accent"
                    >
                      {developed ? (
                        <Check className="size-3" aria-hidden="true" />
                      ) : (
                        <Clock className="size-3" aria-hidden="true" />
                      )}
                      {developed ? copy.opened : copy.developing}
                    </motion.span>
                  </AnimatePresence>
                </div>

                <div className="relative">
                  <div className="grid grid-cols-2 gap-2 px-3 pb-4">
                    {photos.map((photo, index) => (
                      <motion.div
                        key={photo.src}
                        initial={false}
                        animate={
                          developed
                            ? { filter: 'blur(0px) brightness(1)', scale: 1 }
                            : {
                                filter: 'blur(5px) brightness(0.35)',
                                scale: 1.025,
                              }
                        }
                        transition={{
                          duration: reduceMotion ? 0 : 0.55,
                          delay: reduceMotion ? 0 : index * 0.08,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        className="relative aspect-square overflow-hidden rounded-xl"
                      >
                        <Image
                          src={photo.src}
                          alt={photo.alt[locale]}
                          fill
                          sizes="140px"
                          className="object-cover"
                        />
                      </motion.div>
                    ))}
                  </div>

                  <motion.div
                    initial={false}
                    animate={{
                      opacity: developed ? 0 : 1,
                      scale: developed ? 0.98 : 1,
                    }}
                    transition={{
                      duration: reduceMotion ? 0 : 0.28,
                      delay: developed && !reduceMotion ? 0.12 : 0,
                    }}
                    aria-hidden={developed}
                    className={`absolute inset-0 flex items-center justify-center px-6 pb-4 ${
                      developed ? 'pointer-events-none' : ''
                    }`}
                  >
                    <div className="glass-strong rounded-2xl px-5 py-4 text-center">
                      <p className="text-sm font-semibold">{copy.waiting}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {copy.waitingBody}
                      </p>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
