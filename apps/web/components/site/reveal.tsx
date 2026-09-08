'use client'

import { cn } from '@/lib/utils'
import { useEffect, useRef, useState, type ReactNode } from 'react'

interface RevealProps {
  children: ReactNode
  className?: string
  delay?: number
  as?: 'div' | 'section' | 'li' | 'article' | 'header'
}

export function Reveal({
  children,
  className,
  delay = 0,
  as = 'div',
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  // Drives `will-change` for the duration of the transition and no longer —
  // see the `.reveal` rules in globals.css for why it is not simply always on.
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true)
            setAnimating(true)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const Tag = as as 'div'

  return (
    <Tag
      ref={ref}
      className={cn(
        'reveal',
        visible && 'is-visible',
        animating && 'reveal-animating',
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
      // Children transition too — a card hovering inside a revealed section
      // would otherwise re-arm `will-change` on the whole section. Opacity and
      // transform each fire one event; settling twice is a no-op.
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget) setAnimating(false)
      }}
    >
      {children}
    </Tag>
  )
}
