import { Comparison, Cta, Faq } from '@/components/blog/mdx-blocks'
import type { MDXComponents } from 'mdx/types'
import Link from 'next/link'

/**
 * Maps markdown to the site's type styles.
 *
 * Required at the project root by @next/mdx — without it every post renders as
 * unstyled browser defaults, which on a near-black background means black text
 * on black. Kept in step with the headings and body copy in
 * `components/site/page-shell.tsx` and the legal pages; a post should not look
 * like it came from a different site.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <h1 className="mt-12 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mt-12 text-2xl font-semibold tracking-tight text-balance">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mt-8 text-lg font-semibold text-balance">{children}</h3>
    ),
    p: ({ children }) => (
      <p className="mt-4 leading-relaxed text-pretty text-muted-foreground">
        {children}
      </p>
    ),
    ul: ({ children }) => (
      <ul className="mt-4 list-disc space-y-2 pl-6 text-muted-foreground">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="mt-4 list-decimal space-y-2 pl-6 text-muted-foreground">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    strong: ({ children }) => (
      <strong className="font-semibold text-foreground">{children}</strong>
    ),
    blockquote: ({ children }) => (
      <blockquote className="glass mt-6 rounded-2xl border-l-2 border-accent/40 px-6 py-4">
        {children}
      </blockquote>
    ),
    // Internal links go through next/link for client-side navigation;
    // anything absolute stays a plain anchor.
    a: ({ href, children }) => {
      const target = href ?? '#'
      return target.startsWith('/') ? (
        <Link
          href={target}
          className="text-accent underline underline-offset-4 transition-colors hover:text-foreground"
        >
          {children}
        </Link>
      ) : (
        <a
          href={target}
          rel="noopener noreferrer"
          className="text-accent underline underline-offset-4 transition-colors hover:text-foreground"
        >
          {children}
        </a>
      )
    },
    hr: () => <hr className="mt-12 border-border" />,
    // GFM tables. Wrapped rather than styled alone: a table with four
    // columns does not fit 390px, and the page body must never be what
    // scrolls sideways.
    table: ({ children }) => (
      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border-b border-border px-4 py-3 text-left font-semibold">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border-b border-border px-4 py-3 align-top text-muted-foreground">
        {children}
      </td>
    ),
    // Deliberately a plain <img>, not next/image: markdown carries no
    // dimensions, and next/image without them means either `fill` plus a sized
    // wrapper or a guessed aspect ratio that crops someone's photo. An author
    // who wants an optimised hero can import <Image> in the MDX itself.
    img: ({ src, alt }) => (
      // eslint-disable-next-line @next/next/no-img-element -- see above
      <img
        src={typeof src === 'string' ? src : ''}
        alt={alt ?? ''}
        loading="lazy"
        decoding="async"
        className="mt-6 w-full rounded-2xl"
      />
    ),
    // Available in every post without an import line.
    Cta,
    Faq,
    Comparison,
    ...components,
  }
}
