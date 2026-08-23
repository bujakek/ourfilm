'use client'

import { useCountUp } from './use-count-up'

export interface Stat {
  end: number
  format: (v: number) => string
  label: string
}

/**
 * A row of counters that animate into view.
 *
 * Content-free on purpose. This used to carry a hardcoded list — an average
 * rating, a photo total, an event count — none of which was measured, and all
 * of which read as fact on a landing page. The caller now supplies the
 * numbers, so the component cannot invent any; while there are none to supply,
 * `app/[locale]/page.tsx` simply does not render it.
 */
function StatCard({ stat, delay }: { stat: Stat; delay: number }) {
  const { ref, value } = useCountUp(stat.end)
  return (
    <div
      ref={ref}
      className="glass glass-hover flex flex-col items-center rounded-3xl px-6 py-8 text-center"
      style={{ transitionDelay: `${delay}ms` }}
    >
      <span className="text-gradient text-4xl font-semibold tracking-tight sm:text-5xl">
        {stat.format(value)}
      </span>
      <span className="mt-2 text-sm text-muted-foreground">{stat.label}</span>
    </div>
  )
}

export function Stats({ stats }: { stats: Stat[] }) {
  if (stats.length === 0) return null

  return (
    <section className="relative px-4 py-8 sm:px-6">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <StatCard key={stat.label} stat={stat} delay={i * 80} />
        ))}
      </div>
    </section>
  )
}
