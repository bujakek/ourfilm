'use client'

import { Check, QrCode, ScanLine } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { Locale } from '@/lib/i18n'
import { marketingCopy } from '@/lib/marketing-copy'
import { T, still } from '@/lib/motion'

export function HeroQrDemo({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].demo
  const reduceMotion = useReducedMotion()
  const [complete, setComplete] = useState(false)

  useEffect(() => {
    if (reduceMotion) return

    let successTimer: number | null = null
    const run = () => {
      setComplete(false)
      successTimer = window.setTimeout(() => setComplete(true), 1300)
    }

    run()
    const interval = window.setInterval(run, 5200)

    return () => {
      window.clearInterval(interval)
      if (successTimer !== null) window.clearTimeout(successTimer)
    }
  }, [reduceMotion])

  return (
    <div className="absolute top-8 -right-2 w-[34%] max-w-[132px] animate-float-slower [animation-delay:-8s]">
      <motion.div
        animate={
          complete && !reduceMotion ? { scale: [1, 1.025, 1] } : { scale: 1 }
        }
        transition={reduceMotion ? still : T.settle}
        className="glass-strong relative overflow-hidden rounded-2xl p-3"
      >
        <div className="flex items-center justify-center rounded-xl bg-white p-2">
          <QrCode
            className="size-full text-black"
            strokeWidth={1.2}
            aria-hidden="true"
          />
        </div>
        <p className="mt-2 text-center text-[9px] font-medium text-muted-foreground">
          {copy.scan}
        </p>

        {!reduceMotion ? (
          <motion.span
            key={complete ? 'idle' : 'scan'}
            initial={{ y: -28, opacity: 0 }}
            animate={
              complete
                ? { y: -28, opacity: 0 }
                : { y: 72, opacity: [0, 0.7, 0.7, 0] }
            }
            // The one duration left outside `lib/motion.ts`. It is not a
            // transition between two states — it is the length of a decorative
            // sweep, and folding it into a token would either change what the
            // scanner looks like or add a token nothing else can use.
            transition={{ duration: 1.15, ease: 'linear' }}
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-3 top-3 h-7 rounded-lg bg-gradient-to-b from-accent/45 to-transparent"
          />
        ) : null}
      </motion.div>

      <div className="glass absolute -bottom-3 -left-3 flex min-w-[5.2rem] items-center gap-1 rounded-full px-2.5 py-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={complete ? 'complete' : 'scanning'}
            initial={reduceMotion ? false : { opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -3 }}
            transition={reduceMotion ? still : T.settle}
            className="flex items-center gap-1"
          >
            {complete ? (
              <Check className="size-3 text-accent" aria-hidden="true" />
            ) : (
              <ScanLine className="size-3 text-accent" aria-hidden="true" />
            )}
            <span className="text-[9px] font-medium">
              {complete ? copy.ready : copy.scanning}
            </span>
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  )
}
