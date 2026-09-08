'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'

import { T, still } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * A number that rolls when it changes.
 *
 * One component rather than three: the guest's frame counter, the create
 * flow's step number and every realtime figure on the host console are the
 * same animation, and three implementations of it would have drifted inside a
 * month — which is the whole argument of `lib/motion.ts`, applied to a
 * component instead of a curve.
 *
 * Three details are load-bearing:
 *
 * - **`initial={false}`.** The number must not roll on first paint. A counter
 *   that animates from nothing on arrival is claiming something changed when
 *   the page merely loaded.
 * - **An explicit width, and one that never shrinks.** `21 → 20` must not
 *   reflow whatever sits beside the number, and `10 → 9` must not clip the
 *   digit on its way out. The box is sized by an invisible sizer holding the
 *   widest digit string this instance has ever shown — real glyphs in the
 *   caller's own face, so it is right under letter-spacing that a `ch`
 *   calculation would miss.
 * - **Both digits are absolutely positioned** over that sizer. That is what
 *   `AnimatePresence mode="popLayout"` would otherwise be for; doing it in CSS
 *   means the box is measured by something that is not either of the two
 *   values mid-swap, which is the only way the width can stay still.
 *
 * `dir` is the direction the value travels, not the direction of the motion:
 * a decrementing count is `'down'`, and its digits enter from above the way a
 * mechanical counter's would.
 */
export function Odometer({
  value,
  dir,
  pad = 1,
  className,
}: {
  value: number
  /** `'down'` for a decrementing count, `'up'` for an incrementing one. */
  dir: 'up' | 'down'
  /** Minimum digits, zero-padded. `01 / 04` reads as a set; `1 / 4` does not. */
  pad?: number
  className?: string
}) {
  const reduceMotion = useReducedMotion()
  const enter = dir === 'down' ? '-84%' : '84%'
  const leave = dir === 'down' ? '84%' : '-84%'

  // A high-water mark, adjusted during render the way React documents for
  // state derived from props: the box may grow when the count crosses a digit
  // boundary, but it must never shrink while the wider value is still sliding
  // out of it.
  const shown = String(value).padStart(pad, '0')
  const digits = shown.length
  const [widest, setWidest] = useState(digits)
  if (digits > widest) setWidest(digits)

  return (
    <span
      className={cn(
        'relative inline-block overflow-hidden text-center tabular-nums',
        className,
      )}
    >
      <span aria-hidden="true" className="invisible block">
        {'0'.repeat(Math.max(widest, digits))}
      </span>

      <AnimatePresence initial={false}>
        <motion.span
          key={value}
          initial={{ y: enter, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: leave, opacity: 0 }}
          transition={reduceMotion ? still : T.advance}
          className="absolute inset-0 block"
        >
          {shown}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
