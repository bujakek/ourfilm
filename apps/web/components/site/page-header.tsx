import type { ReactNode } from 'react'

interface PageHeaderProps {
  /** Short uppercase section marker shown in the pill above the title. */
  eyebrow: string
  title: ReactNode
  /** One or two sentences under the title. */
  lead?: ReactNode
}

/**
 * The standard header rhythm for a standalone page.
 *
 * Extracted from `PageShell` so the blog can reuse it: blog routes get their
 * chrome from `app/blog/layout.tsx` instead, and would otherwise have to
 * duplicate this markup to look like every other page.
 *
 * `pt-32` clears the fixed nav pill; the homepage gets away without it because
 * the hero is built to sit under the nav, and these pages are not.
 */
export function PageHeader({ eyebrow, title, lead }: PageHeaderProps) {
  return (
    <section className="relative px-4 pt-32 pb-10 sm:px-6 sm:pt-40 sm:pb-14">
      <div className="mx-auto max-w-3xl">
        {/* A label, not a chip. The glass pill made every page open with the
            same material its cards were made of, and the lilac on it was one
            of the nine decorative uses that left the colour meaning nothing. */}
        <p className="font-mono text-[10px] font-medium tracking-[0.24em] text-accent">
          {eyebrow}
        </p>
        <h1 className="mt-5 font-display text-[40px] leading-[1.02] tracking-[-0.015em] text-balance sm:text-[58px]">
          {title}
        </h1>
        {lead ? (
          <p className="mt-5 text-lg leading-relaxed text-pretty text-muted-foreground">
            {lead}
          </p>
        ) : null}
      </div>
    </section>
  )
}
