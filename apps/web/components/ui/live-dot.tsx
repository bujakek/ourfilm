'use client'

import { motion, useReducedMotion } from 'motion/react'

import { breath } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * The event is happening, said as a pulse rather than a word.
 *
 * One component for the two surfaces that show it — the guest's status line
 * and the running section of the host's dashboard — because it is the same
 * dot, and rule 7 turns on there being exactly one looping thing in the
 * product. Two implementations is how that quietly becomes two.
 *
 * The host console deliberately does not use it. That page is left open for
 * six hours beside a host who is not looking at it, and nothing on it is
 * allowed to move on its own.
 *
 * `useReducedMotion` drops the loop entirely rather than collapsing it: a
 * two-and-a-half second pulse at zero duration is a strobe.
 *
 * The dot takes `currentColor`, so the row it sits in decides what it means.
 * That is what lets the guest's status row show the same 5px dot in amber when
 * the connection is gone — a second marker in a second shape would have read
 * as a second kind of thing. Every existing caller already sets `text-accent`
 * on the span around it, so nothing about the live dot changed colour.
 */
export function LiveDot({
  className,
  /** Only a running event breathes. A dot that pulses while the connection is
   *  down would be saying the opposite of what it is there to say. */
  pulse = true,
}: {
  className?: string
  pulse?: boolean
}) {
  const reduceMotion = useReducedMotion()

  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-flex size-[5px] shrink-0 items-center justify-center',
        className,
      )}
    >
      {pulse && !reduceMotion ? (
        <motion.span
          animate={{ scale: [1, 1.6], opacity: [0.7, 0] }}
          transition={breath}
          className="absolute size-[5px] rounded-full bg-current"
        />
      ) : null}
      <span className="size-[5px] rounded-full bg-current" />
    </span>
  )
}
