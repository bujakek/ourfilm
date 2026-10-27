import type { ReactNode } from 'react'

import type { LegalSection } from '@/components/site/legal-sections'
import { cn } from '@/lib/utils'

import { SITE_HEADING, SITE_KICKER, SITE_LEAD } from './layout'

/**
 * The narrow reading column of the about and legal pages: a heading, one
 * introductory paragraph, a rule, and the text.
 */
export function InfoPage({
  kicker,
  title,
  intro,
  children,
}: {
  kicker?: string
  title: string
  intro?: string
  children: ReactNode
}) {
  return (
    <article className="mx-auto w-[90%] max-w-[800px] pt-25 pb-[70px] tab:pb-[120px]">
      {kicker ? (
        <p className={cn(SITE_KICKER, 'mb-[22px] tab:mb-7')}>{kicker}</p>
      ) : null}
      <h1 className={cn(SITE_HEADING, 'mb-5 text-center tab:text-left')}>
        {title}
      </h1>
      {intro ? (
        <p
          className={cn(
            SITE_LEAD,
            'mb-[34px] text-center tab:mb-14 tab:text-left',
          )}
        >
          {intro}
        </p>
      ) : null}
      <div className="site-prose site-prose-info border-t border-site-line pt-8 tab:pt-14">
        {children}
      </div>
    </article>
  )
}

/** Numbered legal sections, each a heading and its paragraphs. */
export function InfoSections({ sections }: { sections: LegalSection[] }) {
  return (
    <>
      {sections.map((section, i) => (
        <section key={section.title}>
          <h2>
            {i + 1}. {section.title}
          </h2>
          {section.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {section.links?.map((link) => (
            <p key={link.href}>
              <a href={link.href}>{link.label}</a>
            </p>
          ))}
        </section>
      ))}
    </>
  )
}
