import createMDX from '@next/mdx'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a blog post be an .mdx file that *is* the page, rather than a
  // markdown string parsed at runtime by a loader we would have to write.
  pageExtensions: ['ts', 'tsx', 'mdx'],
  /**
   * The old unprefixed URLs, kept alive.
   *
   * Every source is spelled out. A catch-all like `/:path*` would swallow
   * `/e/…` and `/admin` — the two route trees that must never move, because
   * QR codes are printed with the first and `proxy.ts` guards the second by
   * exact path.
   *
   * 308 (`permanent: true`) rather than 307: these moved for good, and a
   * permanent redirect is what passes the ranking signal on to the new URL.
   */
  async redirects() {
    const moved = [
      '/arak',
      '/alkalmak',
      '/rolunk',
      '/kapcsolat',
      '/aszf',
      '/adatvedelem',
      '/blog',
    ]

    return [
      { source: '/', destination: '/hu', permanent: true },
      ...moved.map((path) => ({
        source: path,
        destination: `/hu${path}`,
        permanent: true,
      })),
      // Sub-paths of the two sections that have them.
      {
        source: '/alkalmak/:slug',
        destination: '/hu/alkalmak/:slug',
        permanent: true,
      },
      { source: '/blog/:slug', destination: '/hu/blog/:slug', permanent: true },
    ]
  },
  images: {
    // Optimization is ON so the landing page's local assets get responsive
    // srcsets — a 1024px source has no business being downloaded into a 140px
    // tile. A global `unoptimized: true` silently voids every `sizes` prop.
    //
    // Guest photos are a different case: they are already compressed to spec
    // client-side (4096px / q92, see .cursor/skills/fomio-upload) and served
    // straight from Supabase Storage, so re-optimizing them buys nothing and
    // costs per-image quota. Put `unoptimized` on those <Image> tags
    // individually when the gallery lands, not here.
    formats: ['image/avif', 'image/webp'],
  },
}

const withMDX = createMDX({
  options: {
    // Plugin names as STRINGS, not imported functions. Turbopack runs the MDX
    // pipeline in Rust and cannot be handed a JS function, so the usual
    // `remarkPlugins: [remarkGfm]` form fails there while looking correct.
    //
    // remark-frontmatter parses the `---` block as frontmatter instead of
    // rendering it as a horizontal rule followed by stray text. gray-matter
    // reads the same block off disk for the index, sitemap and RSS; this is
    // what stops it appearing twice.
    remarkPlugins: ['remark-frontmatter', 'remark-gfm'],
  },
})

export default withMDX(nextConfig)
