import type { Locale } from '@/lib/i18n'
import type { MDXProps } from 'mdx/types'
import type { ComponentType } from 'react'

type MdxModule = { default: ComponentType<MDXProps> }

/**
 * Loads an article's compiled body.
 *
 * One entry per locale, and each template literal interpolates **one**
 * variable. `import(\`@/content/blog/${locale}/${slug}.mdx\`)` looks tidier and
 * is a worse bet: two variables leave the bundler to infer a context module
 * across a directory tree, and the failure shows up as a build error or an
 * empty page rather than a type error. One line per language is a cheap price
 * for a resolution the bundler can see statically.
 *
 * `Record<Locale, …>` is deliberate: adding `'en'` to `locales` makes this
 * object a type error until the loader is added, which is the reminder you
 * want at exactly that moment.
 */
const loaders: Record<Locale, (slug: string) => Promise<MdxModule>> = {
  hu: (slug) => import(`@/content/blog/hu/${slug}.mdx`),
  // en: (slug) => import(`@/content/blog/en/${slug}.mdx`),
}

export async function loadPostContent(
  locale: Locale,
  slug: string,
): Promise<ComponentType<MDXProps>> {
  const { default: Content } = await loaders[locale](slug)
  return Content
}
