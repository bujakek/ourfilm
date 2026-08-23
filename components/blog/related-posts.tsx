import { getRelatedPosts } from '@/lib/blog/posts'
import type { BlogPost } from '@/lib/blog/types'
import type { Locale } from '@/lib/i18n'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

const HEADING: Record<Locale, string> = {
  hu: 'Kapcsolódó írások',
}

/**
 * "Read next", driven by the `related` ids in frontmatter.
 *
 * Ids rather than URLs, so a link keeps working when the article is translated
 * and its slug changes language. Resolution is same-locale only — a Hungarian
 * reader is never sent to an English page.
 */
export function RelatedPosts({ post }: { post: BlogPost }) {
  const related = getRelatedPosts(post)
  if (related.length === 0) return null

  const locale = post.locale as Locale

  return (
    <section className="mt-16 border-t border-border pt-10">
      <h2 className="text-lg font-semibold tracking-tight">
        {HEADING[locale]}
      </h2>
      <ul className="mt-4 space-y-3">
        {related.map((item) => (
          <li key={item.slug}>
            <Link
              href={item.href}
              className="glass glass-hover group flex items-center justify-between gap-4 rounded-2xl px-5 py-4"
            >
              <span className="min-w-0">
                <span className="block font-medium text-balance">
                  {item.title}
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </span>
              </span>
              <ArrowRight
                className="size-4 shrink-0 text-accent transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
