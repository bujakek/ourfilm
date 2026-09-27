import type { MDXComponents } from 'mdx/types'
import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * What an article body is made of on the new blog pages.
 *
 * The site-wide `mdx-components.tsx` gives every element its own utility
 * classes for the older content pages. Here the elements are left bare and
 * `.site-prose` in `globals.css` styles them, so the article reads like the
 * approved design without touching the pages that still use the old look.
 * The three blocks an article can use are redrawn the same way.
 */
export const proseComponents: MDXComponents = {
  h1: ({ children }) => <h2>{children}</h2>,
  h2: ({ children }) => <h2>{children}</h2>,
  h3: ({ children }) => <h3>{children}</h3>,
  p: ({ children }) => <p>{children}</p>,
  ul: ({ children }) => <ul>{children}</ul>,
  ol: ({ children }) => <ol>{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong>{children}</strong>,
  blockquote: ({ children }) => <blockquote>{children}</blockquote>,
  hr: () => <hr />,
  a: ({ href, children }) => <ProseLink href={href}>{children}</ProseLink>,
  // A wide table scrolls inside its own box; the page never does.
  table: ({ children }) => (
    <div className="site-prose-table">
      <table>{children}</table>
    </div>
  ),
  th: ({ children }) => <th>{children}</th>,
  td: ({ children }) => <td>{children}</td>,
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element -- markdown carries no dimensions
    <img
      src={typeof src === 'string' ? src : ''}
      alt={alt ?? ''}
      loading="lazy"
      decoding="async"
    />
  ),
  Cta: ({
    href,
    label,
    children,
  }: {
    href: string
    label: string
    children?: ReactNode
  }) => (
    <aside>
      {children ? <div>{children}</div> : null}
      <ProseLink href={href}>{label}</ProseLink>
    </aside>
  ),
  Faq: ({ items }: { items: { q: string; a: string }[] }) => (
    <dl>
      {items.map((item) => (
        <div key={item.q}>
          <dt>{item.q}</dt>
          <dd>{item.a}</dd>
        </div>
      ))}
    </dl>
  ),
  Comparison: ({
    left,
    right,
    rows,
  }: {
    left: string
    right: string
    rows: { left: string; right: string }[]
  }) => (
    <div className="site-prose-table">
      <table>
        <thead>
          <tr>
            <th>{left}</th>
            <th>{right}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.left}>
              <td>{row.left}</td>
              <td>{row.right}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
}

/** Internal links go through next/link; anything absolute stays an anchor. */
function ProseLink({ href, children }: { href?: string; children: ReactNode }) {
  const target = href ?? '#'
  return target.startsWith('/') ? (
    <Link href={target}>{children}</Link>
  ) : (
    <a href={target} rel="noopener noreferrer">
      {children}
    </a>
  )
}
