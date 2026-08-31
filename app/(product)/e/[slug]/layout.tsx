import { BackgroundGlow } from '@/components/site/background-glow'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

/**
 * `noindex` lives on the layout so it covers every event route — the event
 * page, upload and gallery — rather than each page remembering to set it.
 *
 * Album privacy rests entirely on the URL being unguessable, so a slug landing
 * in a search index would undo it for good. Note that `robots.ts` deliberately
 * does *not* disallow `/e/`: a crawler has to be allowed to fetch the page in
 * order to see this and drop the URL again.
 *
 * Metadata merges down the tree, so a page setting only `title` keeps this.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
}

/**
 * Deliberately fetches nothing.
 *
 * The join gate used to live here, wrapping `children`. That looked like the
 * tidy place for it and was the wrong one twice over. It read localStorage, so
 * the decision could only be made after hydration — every guest who had
 * already joined saw the gate flash on every navigation. And a layout cannot
 * gate a fetch anyway: Next renders the child segment and hands the layout the
 * *result*, so the page below ran, queried, and serialised its photos into the
 * flight payload whether or not this component chose to render them. Measured,
 * not assumed — a gated gallery shipped all seven `thumb_path`s and every
 * uploader name to a visitor who had typed nothing.
 *
 * The gate now sits in each page, where it can return before fetching. What is
 * left here is the backdrop, and a layout that costs no round trip in front of
 * every page beneath it.
 */
export default function EventLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <BackgroundGlow />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
