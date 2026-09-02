import type { Transition } from 'motion/react'

/**
 * Every transition in the product, named.
 *
 * Four curves cover the guest roll, the create flow and the host console. Two
 * of them were already the values in the codebase — copy-pasted into eight
 * components, where they had started to drift by a hundredth of a second at a
 * time. Naming them is the whole point: a literal in a component is a decision
 * nobody can review, and five components each animating "about a fifth of a
 * second" is how a product stops feeling like one thing.
 *
 * The rule that follows from this file: **no duration or easing literal outside
 * it.** Stagger delays are the exception — a delay is a position in a sequence,
 * not a curve, and it belongs next to the sequence it orders.
 *
 * Which one to reach for, per rule 5 of the motion pass: springs for fingers,
 * tweens for film, cross-fades for state. If you cannot say which of the three
 * a new animation is, it does not belong.
 */
export const T = {
  /** Anything arriving or leaving. The default; reach for it first. */
  settle: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
  /** Direct manipulation only: taps, toggles, segmented indicators. */
  snap: { type: 'spring', stiffness: 480, damping: 38 },
  /** Mechanical moves: rolling numbers, the progress hairline. */
  advance: { duration: 0.34, ease: [0.22, 0.9, 0.24, 1] },
  /** A photograph becoming visible, and the only duration over half a second. */
  develop: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
  /** A surface being dismissed, which should read as faster than its arrival. */
  exit: { duration: 0.16, ease: [0.4, 0, 1, 1] },
} as const satisfies Record<string, Transition>

/**
 * What `useReducedMotion()` collapses to.
 *
 * Zero duration rather than no animation at all: the chain still runs and every
 * element still lands at its resting style, it just arrives instantly. A guard
 * that skips the animation entirely is how an element gets stranded on its
 * start keyframe.
 */
export const still = { duration: 0 } as const satisfies Transition

/**
 * A ticket being handed over: it drops a little and straightens.
 *
 * Exported as one object rather than written out twice, because it belongs to
 * two surfaces — the guest's join stub and the QR sheet at the end of the
 * create flow. Same object in the product, so it has to be the same motion;
 * two copies of three numbers is how that stops being true.
 *
 * Pair it with a `transition` from `T` at the call site: the curve is
 * `settle`, but where it sits in a load sequence is the caller's business.
 */
export const ticket = {
  initial: { opacity: 0, y: -14, rotate: -0.6 },
  animate: { opacity: 1, y: 0, rotate: 0 },
} as const
