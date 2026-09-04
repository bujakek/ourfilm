import createMDX from '@next/mdx'

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // The app has two root layouts — `app/[locale]` and `app/(product)` — so
    // `<html lang>` can be correct on both halves. That leaves no single
    // layout for Next to compose an unmatched-URL 404 from, which is what
    // `app/global-not-found.tsx` replaces. Without this flag that file is
    // inert and 404s silently fall back to Next's built-in page.
    globalNotFound: true,
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self' https://checkout.stripe.com",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co",
      "media-src 'self' blob: https://*.supabase.co",
      "worker-src 'self' blob:",
      'upgrade-insecure-requests',
    ].join('; ')
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(self), microphone=(), geolocation=(), payment=(self)',
          },
        ],
      },
    ]
  },
  // Lets a blog post be an .mdx file that *is* the page, rather than a
  // markdown string parsed at runtime by a loader we would have to write.
  pageExtensions: ['ts', 'tsx', 'mdx'],
  /**
   * The old unprefixed URLs, kept alive.
   *
   * Every source is spelled out. A catch-all like `/:path*` would swallow
   * `/e/…` and `/host` — the two route trees that must never move, because
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
      // The bare domain lands on Hungarian while the pilot is Hungarian —
      // see `defaultLocale` in `lib/i18n.ts`, which must agree with this.
      //
      // 307, not 308, unlike every redirect below it: this one is a current
      // decision rather than a URL that moved for good. A browser caches a 308
      // indefinitely, so flipping the default back would leave returning
      // visitors pinned to the old language with nothing the server can say
      // about it.
      { source: '/', destination: '/hu', permanent: false },
      { source: '/en/arak', destination: '/en/pricing', permanent: true },
      { source: '/en/alkalmak', destination: '/en/occasions', permanent: true },
      {
        source: '/en/alkalmak/:slug',
        destination: '/en/occasions/:slug',
        permanent: true,
      },
      { source: '/en/rolunk', destination: '/en/about', permanent: true },
      { source: '/en/kapcsolat', destination: '/en/contact', permanent: true },
      { source: '/en/aszf', destination: '/en/terms', permanent: true },
      {
        source: '/en/adatvedelem',
        destination: '/en/privacy',
        permanent: true,
      },
      { source: '/en/impresszum', destination: '/en/legal', permanent: true },
      {
        source: '/en/alternativak',
        destination: '/en/alternatives',
        permanent: true,
      },
      {
        source: '/en/alternativak/:slug',
        destination: '/en/alternatives/:slug',
        permanent: true,
      },
      {
        source: '/en/osszehasonlitas',
        destination: '/en/comparisons',
        permanent: true,
      },
      {
        source: '/en/osszehasonlitas/:slug',
        destination: '/en/comparisons/:slug',
        permanent: true,
      },
      { source: '/hu/pricing', destination: '/hu/arak', permanent: true },
      { source: '/hu/occasions', destination: '/hu/alkalmak', permanent: true },
      {
        source: '/hu/occasions/:slug',
        destination: '/hu/alkalmak/:slug',
        permanent: true,
      },
      { source: '/hu/about', destination: '/hu/rolunk', permanent: true },
      { source: '/hu/contact', destination: '/hu/kapcsolat', permanent: true },
      { source: '/hu/terms', destination: '/hu/aszf', permanent: true },
      {
        source: '/hu/privacy',
        destination: '/hu/adatvedelem',
        permanent: true,
      },
      { source: '/hu/legal', destination: '/hu/impresszum', permanent: true },
      {
        source: '/hu/alternatives',
        destination: '/hu/alternativak',
        permanent: true,
      },
      {
        source: '/hu/alternatives/:slug',
        destination: '/hu/alternativak/:slug',
        permanent: true,
      },
      {
        source: '/hu/comparisons',
        destination: '/hu/osszehasonlitas',
        permanent: true,
      },
      {
        source: '/hu/comparisons/:slug',
        destination: '/hu/osszehasonlitas/:slug',
        permanent: true,
      },
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
      // The pilot keeps legal requests on one Contact page. Preserve links
      // shared while the two standalone drafts existed.
      {
        source: '/hu/elallas',
        destination: '/hu/kapcsolat#elallas',
        permanent: true,
      },
      {
        source: '/hu/jogserto-tartalom-bejelentese',
        destination: '/hu/kapcsolat#kepeltavolitas',
        permanent: true,
      },
      // The host area was `/admin` until the route was renamed. Kept because
      // the word collided with `profiles.role = 'admin'`, which is the operator
      // who sees every event — not the couple whose wedding this is. Existing
      // bookmarks and any link already sent to a host still work.
      //
      // Safe as a catch-all in a way the marketing ones are not: `/admin` has
      // no siblings it could swallow, unlike a bare `/:path*` which would eat
      // `/e/` and every printed QR code with it.
      { source: '/admin', destination: '/host', permanent: true },
      {
        source: '/admin/:path*',
        destination: '/host/:path*',
        permanent: true,
      },
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
