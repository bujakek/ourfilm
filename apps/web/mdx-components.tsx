import type { MDXComponents } from 'mdx/types'

import { proseComponents } from '@/components/pages/prose-components'

/**
 * Maps markdown to the site's article elements.
 *
 * Required at the project root by @next/mdx — without it every post renders as
 * unstyled browser defaults, which on a near-black background means black text
 * on black. The elements are the blog's own (`proseComponents`), left bare for
 * `.site-prose` to style, so every MDX body must sit inside that class. `Cta`,
 * `Faq` and `Comparison` come with them and need no import line in a post.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return { ...proseComponents, ...components }
}
