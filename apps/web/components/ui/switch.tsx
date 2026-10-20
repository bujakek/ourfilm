'use client'

import { motion, useReducedMotion } from 'motion/react'

import { HOST_FOCUS } from '@/components/host/ui/classes'
import { T, still } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * State changes colour; fingers move geometry.
 *
 * The knob rides `snap` and the track's colour crosses on `settle`, and they
 * are deliberately on different tokens. A spring is what a thing being pushed
 * does; a colour has no mass, and springing it is what makes a form feel
 * bouncy all over. The track is two layers with the white one's opacity
 * animated rather than one layer whose `backgroundColor` is, because only
 * opacity interpolates reliably between a wash and a solid.
 *
 * The landing look: a white track and a near-black knob when on. There was a
 * lilac default tone beside it until every caller had moved to this one.
 */
export function SwitchTrack({
  checked,
  disabled = false,
  className,
}: {
  checked: boolean
  disabled?: boolean
  className?: string
}) {
  const reduceMotion = useReducedMotion()

  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-flex h-8 w-14 shrink-0 items-center rounded-full bg-white/14',
        disabled && 'opacity-50',
        className,
      )}
    >
      <motion.span
        className="absolute inset-0 rounded-full bg-white"
        initial={false}
        animate={{ opacity: checked ? 1 : 0 }}
        transition={reduceMotion ? still : T.settle}
      />
      <motion.span
        className={cn(
          'absolute size-6 rounded-full',
          checked ? 'bg-landing' : 'bg-white',
        )}
        initial={false}
        animate={{ x: checked ? 28 : 4 }}
        transition={reduceMotion ? still : T.snap}
      />
    </span>
  )
}

export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  label,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'inline-flex size-14 shrink-0 items-center justify-center rounded-full disabled:opacity-50',
        HOST_FOCUS,
      )}
    >
      <SwitchTrack checked={checked} />
    </button>
  )
}
