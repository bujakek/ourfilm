import { isKnownLocale } from '@/lib/i18n'
import { z } from 'zod'

import { isTopic } from './topics'
import type { ContentFrontmatter } from './types'

/**
 * The frontmatter contract, enforced rather than assumed.
 *
 * A page is a file someone hand-writes and opens a PR with, which makes it
 * exactly the kind of input that is wrong occasionally: a missing date, a slug
 * with a capital letter in it, `related` pointing at a document that was
 * renamed. Every one of those fails silently without a check here — a post
 * page that vanishes from its hub, or a link that 404s — so the build stops
 * instead, naming the file and the field.
 *
 * The schema deliberately avoids zod's newer sugar (`z.iso.date()`,
 * `z.enum(locales)` over a readonly tuple). A regex and a refine behave the
 * same on any zod 3 or 4, and this file is not worth a migration one day.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Whether a `YYYY-MM-DD` string is a day that exists.
 *
 * The round-trip is the whole check. `new Date('2026-02-31')` does not fail —
 * it silently rolls over to 2026-03-03, so an impossible date would publish an
 * page three days after the one its author wrote down, and sort it there
 * too. Comparing the parsed date back to the input is what catches that.
 */
function isRealDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return false
  return parsed.toISOString().slice(0, 10) === value
}

const dateField = (label: string) =>
  z
    .string()
    .regex(ISO_DATE, `${label} must be an ISO date like 2026-08-23`)
    // Guarded on the regex so one bad value reports one problem, not two.
    .refine(
      (value) => !ISO_DATE.test(value) || isRealDate(value),
      `${label} is not a day that exists`,
    )

const schema = z.object({
  id: z.string().regex(SLUG, 'id must be lowercase-kebab-case'),
  locale: z
    .string()
    .refine(isKnownLocale, 'locale is not one of the known locales'),
  slug: z.string().regex(SLUG, 'slug must be lowercase-kebab-case'),
  title: z.string().min(1),
  description: z.string().min(1),
  publishedAt: dateField('publishedAt'),
  updatedAt: dateField('updatedAt').optional(),
  author: z.string().min(1).optional(),
  image: z
    .string()
    .startsWith('/', 'image must be a site-absolute path')
    .optional(),
  related: z
    .array(z.string().regex(SLUG, 'related entries must be document ids'))
    .optional(),
  // Blog shelving. Refined rather than `z.enum` for the same zod-version
  // reason the locale field is: a refine behaves identically on zod 3 and 4.
  topic: z
    .string()
    .refine(isTopic, 'topic is not one of the known topics')
    .optional(),
  draft: z.boolean().optional(),
})

/**
 * Validates one document's frontmatter.
 *
 * Throws with the file path in the message: a zod error on its own says
 * `slug: Invalid`, which is useless when the build is compiling forty files.
 */
export function parseFrontmatter(
  data: unknown,
  filePath: string,
): ContentFrontmatter {
  const result = schema.safeParse(data)

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid frontmatter in ${filePath}:\n${problems}`)
  }

  return result.data as ContentFrontmatter
}
