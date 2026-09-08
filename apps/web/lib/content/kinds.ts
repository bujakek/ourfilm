/**
 * The five kinds of editorial content, and where each one lives.
 *
 * This is the single place that maps a directory under `content/` to a public
 * URL. Everything else — the routes, the hubs, the sitemap, the internal-link
 * checker — reads it, so a kind cannot be served at one address and listed at
 * another.
 *
 * `vs` and `compare` deliberately share `/osszehasonlitas`: to a reader they
 * are the same shelf (an OurFilm comparison and a competitor-versus-competitor
 * comparison), and splitting the URL would have been a distinction only the
 * repository cares about. The consequence is that a slug must be unique across
 * the two, which `assertNoCollisions` checks by **URL** rather than by kind.
 */

export const contentKinds = [
  'pages',
  'blog',
  'alternatives',
  'vs',
  'compare',
] as const

export type ContentKind = (typeof contentKinds)[number]

/** The listing pages, by their locale-relative path segment. */
export const hubs = ['blog', 'alternativak', 'osszehasonlitas'] as const

export type Hub = (typeof hubs)[number]

interface KindDefinition {
  /**
   * Locale-relative prefix a document of this kind sits under, without a
   * trailing slash. Empty for money pages: they are `/hu/<slug>`, one segment
   * from the marketing pages, because that is the address a commercial query
   * expects to land on.
   */
  prefix: string
  /** Which hub lists it, or `null` for a kind that has no listing page. */
  hub: Hub | null
  /**
   * `WebPage` for OurFilm's own commercial pages, `BlogPosting` for editorial.
   * An OurFilm-vs-competitor page argues for a product we sell, so calling it
   * a blog post would be dressing up a landing page as journalism.
   */
  schemaType: 'WebPage' | 'BlogPosting'
}

export const kindDefinitions: Record<ContentKind, KindDefinition> = {
  pages: { prefix: '', hub: null, schemaType: 'WebPage' },
  blog: { prefix: '/blog', hub: 'blog', schemaType: 'BlogPosting' },
  alternatives: {
    prefix: '/alternativak',
    hub: 'alternativak',
    schemaType: 'WebPage',
  },
  vs: {
    prefix: '/osszehasonlitas',
    hub: 'osszehasonlitas',
    schemaType: 'WebPage',
  },
  // Competitor-versus-competitor. Nothing on the page is a pitch for a product
  // we sell, so it is editorial and typed as such.
  compare: {
    prefix: '/osszehasonlitas',
    hub: 'osszehasonlitas',
    schemaType: 'BlogPosting',
  },
}

/** Which kinds a hub lists, in the order the hub should show them. */
export const hubKinds: Record<Hub, readonly ContentKind[]> = {
  blog: ['blog'],
  alternativak: ['alternatives'],
  osszehasonlitas: ['vs', 'compare'],
}
