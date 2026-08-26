/**
 * The blog's topic shelves.
 *
 * Forty-one guides in one reverse-chronological list is a list nobody reads to
 * the bottom of, so the index groups them. The grouping is declared in each
 * article's own frontmatter rather than in a registry here: a registry has to
 * be edited in lockstep with the content, which is exactly the failure mode
 * `lib/content/docs.ts` was built to remove.
 *
 * `topic` is therefore **optional**. An article that declares none falls into
 * the last shelf, so publishing a post is still one file and nothing else.
 */

export const topics = [
  'vendegkamera',
  'film',
  'eszkozok',
  'otletek',
  'utana',
] as const

export type Topic = (typeof topics)[number]

/** Where an article with no `topic` lands. Not a `Topic` — nothing declares it. */
export const FALLBACK_TOPIC = 'egyeb'

export type TopicKey = Topic | typeof FALLBACK_TOPIC

export function isTopic(value: string): value is Topic {
  return (topics as readonly string[]).includes(value)
}

/** Shelf order on the index, and the Hungarian each shelf is titled with. */
export const topicOrder: readonly TopicKey[] = [...topics, FALLBACK_TOPIC]

export const topicLabel: Record<TopicKey, { title: string; lead: string }> = {
  vendegkamera: {
    title: 'Vendégkamera és QR-kód',
    lead: 'Hogyan állítsd be, hova tedd ki, és mit írj a kód mellé.',
  },
  film: {
    title: 'Eldobható kamera és filmes élmény',
    lead: 'Digitális film, véges képkockák, és mit ad hozzá a hagyományos kamerához képest.',
  },
  eszkozok: {
    title: 'Meglévő eszközök és appok',
    lead: 'Drive, iCloud, WhatsApp és a fotómegosztó alkalmazások — mire jók és hol állnak meg.',
  },
  otletek: {
    title: 'Ötletek az esküvő napjára',
    lead: 'Fotósarok, vendégkönyv, játékok és programok, amelyekben tényleg részt vesznek a vendégek.',
  },
  utana: {
    title: 'Az esküvő után',
    lead: 'Mentés, rendszerezés, minőség és adatvédelem, amikor már megvannak a képek.',
  },
  egyeb: {
    title: 'További útmutatók',
    lead: 'Minden más, ami a vendégfotókról szól.',
  },
}
