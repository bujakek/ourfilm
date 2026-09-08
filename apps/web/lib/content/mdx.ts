import type { Locale } from '@/lib/i18n'
import type { MDXProps } from 'mdx/types'
import type { ComponentType } from 'react'

import type { ContentKind } from './kinds'

type MdxModule = { default: ComponentType<MDXProps> }

const unavailable = async (): Promise<MdxModule> => {
  throw new Error('No English document exists for this content kind.')
}

/**
 * Loads a document's compiled body.
 *
 * One entry per kind per locale, and each template literal interpolates
 * **one** variable. `import(\`@/content/${kind}/${locale}/${slug}.mdx\`)` looks
 * tidier and is a worse bet: more than one variable leaves the bundler to
 * infer a context module across a directory tree, and the failure shows up as
 * a build error or an empty page rather than a type error. One line per
 * directory is a cheap price for a resolution the bundler can see statically.
 *
 * `Record<ContentKind, Record<Locale, …>>` is deliberate: adding `'en'` to
 * `locales`, or a sixth kind, makes this object a type error until the loader
 * is added, which is the reminder you want at exactly that moment.
 */
const loaders: Record<
  ContentKind,
  Record<Locale, (slug: string) => Promise<MdxModule>>
> = {
  pages: {
    hu: (slug) => import(`@/content/pages/hu/${slug}.mdx`),
    en: (slug) => import(`@/content/pages/en/${slug}.mdx`),
  },
  blog: {
    hu: (slug) => import(`@/content/blog/hu/${slug}.mdx`),
    en: (slug) => import(`@/content/blog/en/${slug}.mdx`),
  },
  alternatives: {
    hu: (slug) => import(`@/content/alternatives/hu/${slug}.mdx`),
    en: (slug) => import(`@/content/alternatives/en/${slug}.mdx`),
  },
  vs: {
    hu: (slug) => import(`@/content/vs/hu/${slug}.mdx`),
    en: unavailable,
  },
  compare: {
    hu: (slug) => import(`@/content/compare/hu/${slug}.mdx`),
    en: unavailable,
  },
}

export async function loadDocContent(
  kind: ContentKind,
  locale: Locale,
  slug: string,
): Promise<ComponentType<MDXProps>> {
  const { default: Content } = await loaders[kind][locale](slug)
  return Content
}
