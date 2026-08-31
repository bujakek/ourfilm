import { NotFoundScreen } from '@/components/site/not-found-screen'

/**
 * Renders for a `notFound()` thrown under a locale segment.
 *
 * `not-found.tsx` takes no props — not even `params` — so the locale is not
 * available here. It falls back to the default, which is why the copy lives in
 * a component that can be given one from `global-not-found` later if the two
 * ever need to differ.
 */
export default function NotFound() {
  return <NotFoundScreen />
}
