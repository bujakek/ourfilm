'use client'

import { useReducedMotion, type Transition } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'

import { T, still } from './motion'

/**
 * The load sequence of a screen, as a transition per element.
 *
 * `stage(0)`, `stage(1)`, `stage(2)` — the index is the element's position in
 * the assembly, and the hook turns it into `T.settle` plus a delay. An element
 * that arrives by a different curve passes its own as the second argument and
 * keeps its place in the same count. Entrance animations belong to first paint
 * only (rule 6), so everything about this hook is about *not* running.
 *
 * **`once` is the important argument.** Pass a key and the sequence plays once
 * per browser session rather than once per mount. A guest returns from the OS
 * camera to a page iOS may have frozen, discarded, or reloaded outright;
 * re-assembling the whole screen after every shot is the single worst thing a
 * motion pass could ship, and a component that only knows about mounting
 * cannot tell that case apart from a real first visit. `sessionStorage` can.
 *
 * The flag is read in a `useState` initialiser rather than an effect, so the
 * very first client render already knows the answer and a returning guest sees
 * no animation at all — not even one frame of it. That read is safe where
 * reading storage during render usually is not, because it changes only the
 * transition, never the markup: the server and the client render the same
 * hidden start state, and only the time it takes to leave differs.
 */
export function useEntrance({
  once,
  step,
}: {
  /** `sessionStorage` key. Omit for a sequence that may replay on every mount. */
  once?: string
  /** Seconds between elements. */
  step: number
}): (index?: number, base?: Transition) => Transition {
  const reduceMotion = useReducedMotion()

  const [play] = useState(() => {
    if (typeof window === 'undefined' || !once) return true
    try {
      return window.sessionStorage.getItem(once) === null
    } catch {
      // Storage can be unavailable outright. Playing the sequence is the
      // gentler failure: it is the wrong answer only for a returning guest,
      // where the alternative is the wrong answer for every first visit.
      return true
    }
  })

  useEffect(() => {
    if (!play || !once) return
    try {
      window.sessionStorage.setItem(once, '1')
    } catch {
      // See above.
    }
  }, [once, play])

  return useCallback(
    (index = 0, base: Transition = T.settle) =>
      play && !reduceMotion ? { ...base, delay: index * step } : still,
    [play, reduceMotion, step],
  )
}
