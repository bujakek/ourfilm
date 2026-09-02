import type { Translations } from '@/lib/content/types'
import { type Locale, localeLabel } from '@/lib/i18n'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

/**
 * Links to this article in the other languages it exists in.
 *
 * Renders nothing when there is nowhere to go — which is every article while
 * `locales` is `['hu']`. The href comes from the translation's own slug, never
 * from rewriting the current URL: `/hu/blog/eskuvoi-foto-megosztas` and
 * `/en/blog/wedding-photo-sharing` are the same article and share no path.
 */
export function LanguageSwitcher({
  current,
  translations,
}: {
  current: Locale
  translations: Translations
}) {
  const others = Object.values(translations).filter(
    (ref) => ref.locale !== current,
  )
  if (others.length === 0) return null

  return (
    <nav className="mt-4 flex flex-wrap items-center gap-2">
      {others.map((ref) => (
        <Link
          key={ref.locale}
          href={ref.href}
          hrefLang={ref.locale}
          className={buttonVariants({
            variant: 'secondary',
            size: 'sm',
            className: 'text-xs',
          })}
        >
          {localeLabel[ref.locale]}
        </Link>
      ))}
    </nav>
  )
}
