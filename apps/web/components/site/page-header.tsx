import type { ReactNode } from 'react'

import { SITE_HEADING, SITE_KICKER, SITE_LEAD } from '@/components/pages/layout'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  /** Short section marker shown in capitals above the title. */
  eyebrow: string
  title: ReactNode
  /** One or two sentences under the title. */
  lead?: ReactNode
}

/**
 * The standard header for a standalone page or a content hub, in the column
 * the content under it uses.
 */
export function PageHeader({ eyebrow, title, lead }: PageHeaderProps) {
  return (
    <section className="mx-auto w-[90%] max-w-[800px] pt-[70px] pb-10 tab:pt-25 tab:pb-14">
      <p className={SITE_KICKER}>{eyebrow}</p>
      <h1 className={cn(SITE_HEADING, 'mt-5 text-balance')}>{title}</h1>
      {lead ? (
        <p className={cn(SITE_LEAD, 'mt-5 text-pretty')}>{lead}</p>
      ) : null}
    </section>
  )
}
