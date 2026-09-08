'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Animates a number from 0 to `end` once the element scrolls into view.
 * Returns a ref to attach to the element and the current animated value.
 */
export function useCountUp(end: number, duration = 1800) {
  const ref = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !started.current) {
            started.current = true
            const prefersReduced = window.matchMedia(
              '(prefers-reduced-motion: reduce)',
            ).matches
            if (prefersReduced) {
              setValue(end)
              return
            }
            const start = performance.now()
            const tick = (now: number) => {
              const progress = Math.min((now - start) / duration, 1)
              // easeOutExpo
              const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
              setValue(end * eased)
              if (progress < 1) requestAnimationFrame(tick)
            }
            requestAnimationFrame(tick)
          }
        })
      },
      { threshold: 0.4 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [end, duration])

  return { ref, value }
}
