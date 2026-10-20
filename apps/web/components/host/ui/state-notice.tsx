import type { ReactNode } from 'react'

import { HOST_KICKER, HOST_PANEL_SHAPE } from './classes'

const TONE = {
  neutral: { panel: 'bg-host-panel', title: 'text-white' },
  warn: { panel: 'bg-host-warn-fill', title: 'text-host-warn' },
  danger: { panel: 'bg-host-danger-fill', title: 'text-host-danger' },
} as const

/** Every empty, error and limit state on a host screen. */
export function StateNotice({
  tone,
  kicker,
  title,
  body,
  actions,
  figure,
}: {
  tone: keyof typeof TONE
  kicker?: ReactNode
  title: string
  body: string
  actions?: ReactNode
  figure?: ReactNode
}) {
  const t = TONE[tone]
  return (
    <section
      role={tone === 'danger' ? 'status' : undefined}
      className={`${HOST_PANEL_SHAPE} ${t.panel} p-6`}
    >
      {figure ? (
        <div className="host-figure mb-3 text-[40px]">{figure}</div>
      ) : null}
      {kicker ? <p className={`mb-2 ${HOST_KICKER}`}>{kicker}</p> : null}
      <h2
        className={`landing-serif font-landing-display text-[24px] leading-[1.2] text-balance ${t.title}`}
      >
        {title}
      </h2>
      <p className="mt-2 text-[15px] leading-[1.6] text-pretty text-white/70">
        {body}
      </p>
      {actions ? (
        <div className="mt-5 flex flex-wrap gap-3">{actions}</div>
      ) : null}
    </section>
  )
}
