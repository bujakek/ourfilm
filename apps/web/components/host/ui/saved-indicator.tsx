'use client'

import { motion, useReducedMotion } from 'motion/react'

import type { Locale } from '@/lib/i18n'
import { T, still } from '@/lib/motion'

/** "✓ Mentve" after an autosave. It is always mounted so it never shifts layout. */
export function SavedIndicator({
  visible,
  locale,
}: {
  visible: boolean
  locale: Locale
}) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.span
      role="status"
      initial={false}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={reduceMotion ? still : T.settle}
      className="text-[13px] font-medium text-white/65"
    >
      {visible ? (locale === 'hu' ? '✓ Mentve' : '✓ Saved') : ''}
    </motion.span>
  )
}
