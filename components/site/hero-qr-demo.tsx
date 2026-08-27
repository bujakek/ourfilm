'use client'

import { Check, QrCode, ScanLine } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

export function HeroQrDemo() {
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
          complete && !reduceMotion
            ? { scale: [1, 1.025, 1] }
            : { scale: 1 }
        }
        transition={{ duration: reduceMotion ? 0 : 0.32 }}
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
          Olvasd be, és fotózz velünk.
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
            transition={{ duration: reduceMotion ? 0 : 0.14 }}
            className="flex items-center gap-1"
          >
            {complete ? (
              <Check className="size-3 text-accent" aria-hidden="true" />
            ) : (
              <ScanLine className="size-3 text-accent" aria-hidden="true" />
            )}
            <span className="text-[9px] font-medium">
              {complete ? 'Kész' : 'Beolvasás…'}
            </span>
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  )
}
