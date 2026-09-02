'use client'

import { motion } from 'motion/react'
import type { ReactNode } from 'react'

import { useEntrance } from '@/lib/use-entrance'

/**
 * One block of the host console, arriving.
 *
 * Shallower and faster than the guest's load — 8px and 60ms apart against 10px
 * and 45ms — because this is a page a host returns to rather than a screen
 * they see once. He leaves it open on a laptop for six hours while numbers
 * change without him, so nothing on it is allowed to announce itself.
 *
 * There is no `once` key, unlike the guest roll. Nothing hands this page to
 * another app mid-task: a mount here really is a first paint, and the
 * moderation actions that re-render it go through `router.refresh()`, which
 * reconciles rather than remounting.
 */
export function ConsoleBlock({
  index,
  className,
  children,
}: {
  index: number
  className?: string
  children: ReactNode
}) {
  const stage = useEntrance({ step: 0.06 })

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={stage(index)}
      className={className}
    >
      {children}
    </motion.div>
  )
}
