'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** The distance from the viewport's top at which the column sticks, plus the
 *  room it must leave below itself. */
const STICKY_TOP = 100
const BOTTOM_ROOM = 100

/**
 * A left column that stays in view while the article scrolls — unless it is
 * taller than the window. A long title over a cover can outgrow a laptop
 * screen, and a sticky block taller than the viewport hides its own end for
 * good, so then it simply scrolls with the page.
 *
 * Server-rendered sticky, so the first paint is the common case and only an
 * unusually tall column changes after measuring.
 */
export function StickyAside({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLElement>(null)
  const [tall, setTall] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () =>
      setTall(el.offsetHeight > window.innerHeight - STICKY_TOP - BOTTOM_ROOM)
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    window.addEventListener('resize', measure)
    measure()
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  return (
    <header
      ref={ref}
      className={cn(className, !tall && 'tab:sticky tab:top-25')}
    >
      {children}
    </header>
  )
}
