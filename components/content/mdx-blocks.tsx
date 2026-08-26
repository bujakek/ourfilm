import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * The components an article can use without importing anything.
 *
 * All three are Server Components on purpose. An article body is the one part
 * of this site that must exist in the HTML a crawler receives, so nothing in
 * here may pull the post into the client bundle — no state, no effects, no
 * `'use client'`.
 *
 * They are injected through `mdx-components.tsx`, which is why an MDX file can
 * write `<Cta …/>` with no import line.
 */

/** A call to action inside a post. `href` is written out in full by the
 *  author, locale prefix included — an article already knows its language. */
export function Cta({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children?: ReactNode
}) {
  return (
    <aside className="glass mt-10 rounded-3xl px-6 py-7">
      {children ? (
        <div className="text-pretty text-muted-foreground [&>p:first-child]:mt-0">
          {children}
        </div>
      ) : null}
      <Link
        href={href}
        className="btn-shine mt-5 inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
      >
        {label}
      </Link>
    </aside>
  )
}

/**
 * A question-and-answer block.
 *
 * Rendered as a `<dl>` rather than an accordion: the answers are in the HTML
 * unconditionally, which is both the accessible option and the one a crawler
 * can read. Deliberately no `FAQPage` JSON-LD — Google only surfaces that for
 * a narrow set of sites now, and structured data that overstates what a page
 * is gets a manual action, not a rich result.
 */
export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <dl className="mt-10 space-y-5">
      {items.map((item) => (
        <div key={item.q} className="glass rounded-2xl px-5 py-4">
          <dt className="font-semibold text-balance">{item.q}</dt>
          <dd className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
            {item.a}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * A two-column comparison.
 *
 * A plain markdown table handles most cases now that `remark-gfm` is on; this
 * is for the "them vs us" shape, where the two sides want different emphasis.
 */
export function Comparison({
  left,
  right,
  rows,
}: {
  left: string
  right: string
  rows: { left: string; right: string }[]
}) {
  return (
    <div className="mt-10 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b border-border px-4 py-3 text-left font-semibold text-muted-foreground">
              {left}
            </th>
            <th className="border-b border-border px-4 py-3 text-left font-semibold text-accent">
              {right}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.left}>
              <td className="border-b border-border px-4 py-3 align-top text-muted-foreground">
                {row.left}
              </td>
              <td className="border-b border-border px-4 py-3 align-top">
                {row.right}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
