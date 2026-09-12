import { PageShell } from '@/components/site/page-shell'
import {
  OCCASIONS_ARE_DRAFT,
  occasionBySlug,
  occasionCopy,
  occasions,
} from '@/lib/occasions'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { BackLink } from '@/components/ui/back-link'
import { buttonVariants } from '@/components/ui/button'
import { getDocById } from '@/lib/content/docs'
import { Reveal } from '@/components/site/reveal'

import { CREATE_EVENT_PATH } from '@/lib/routes'
import { notFound } from 'next/navigation'
import { type Locale, isLocale, localePath } from '@/lib/i18n'

type Props = { params: Promise<{ locale: string; occasion: string }> }

/** Four known slugs, so all four prerender and an unknown one 404s. */
export function generateStaticParams() {
  return occasions.map((o) => ({ occasion: o.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, occasion: slug } = await params
  if (!isLocale(locale)) return {}
  const occasion = occasionBySlug(slug)
  if (!occasion) return {}
  const copy = occasionCopy(locale, occasion)

  return {
    title: copy.meta.title,
    description: copy.meta.description,
    openGraph: {
      title: copy.meta.title,
      description: copy.meta.description,
    },
    ...(OCCASIONS_ARE_DRAFT ? { robots: { index: false, follow: true } } : {}),
  }
}

/**
 * One occasion, argued in full.
 *
 * This was a hero, two paragraphs and a button — true, and about a fifth of
 * what somebody deciding between this and a shared Drive folder needs. It is
 * now the shape a landing page for a single use case has to be: the problem in
 * this occasion's own words, six things the camera does said in those same
 * words, the questions this occasion actually raises rather than the
 * homepage's again, and a way further into the site.
 *
 * **Every feature card is a live claim.** They are the same handful of
 * product facts — one QR code, the roll, the reveal, moderation, the ZIP, the
 * print-ready master — turned to face a different occasion. None of them may
 * become a promise about camera-roll upload, video or unlimited photos; see
 * the landing-page promises in `CLAUDE.md`.
 *
 * The page is still `noindex` while `OCCASIONS_ARE_DRAFT` holds, so none of
 * this earns anything yet. That flag is the last thing to flip, not the first.
 */
export default async function OccasionPage({ params }: Props) {
  const { locale, occasion: slug } = await params
  if (!isLocale(locale)) notFound()
  const occasion = occasionBySlug(slug)
  if (!occasion) notFound()
  const copy = occasionCopy(locale, occasion)
  const en = locale === 'en'

  // Ids, not slugs, so a link survives translation — and a post that does not
  // exist in this locale simply drops out. Today that empties the section on
  // every occasion but the wedding, which is the honest state of the blog.
  const posts = (copy.posts ?? [])
    .map((id) => getDocById(locale, id))
    .filter((doc) => doc !== undefined)

  return (
    <PageShell
      locale={locale}
      eyebrow={copy.label.toUpperCase()}
      title={copy.title}
      lead={copy.text}
    >
      <section className="relative px-5 pb-16 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-5xl">
          {/* 16:9, not the 16:7 this started as. Every one of these sources
              is square or taller, so the wider the band the more of the
              subject it throws away — and `imagePosition` can only move the
              crop, not make it less severe. */}
          <div className="relative aspect-[4/3] overflow-hidden rounded-[22px] sm:aspect-[16/9]">
            <Image
              src={occasion.image}
              alt={copy.alt}
              fill
              sizes="(max-width: 1024px) 100vw, 1024px"
              priority
              className={`object-cover ${occasion.imagePosition ?? 'object-center'}`}
            />
          </div>
        </div>
      </section>

      {/* The problem, and where the code goes. Two paragraphs, set wide and
          in the display serif so they read as an argument rather than as body
          copy under a feature list. */}
      <section className="relative border-t border-border px-5 py-18 sm:px-6 lg:px-10 lg:py-20">
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2 lg:gap-16">
          {copy.sections.map((section, i) => (
            <Reveal key={section.heading} delay={i * 90}>
              <h2 className="font-display text-[clamp(24px,4.5vw,32px)] leading-[1.1] tracking-[-0.015em] text-balance">
                {section.heading}
              </h2>
              <p className="mt-4 text-[15.5px] leading-[1.7] text-pretty text-foreground/60">
                {section.body}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="relative border-t border-border px-5 py-18 sm:px-6 lg:px-10 lg:py-20">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <h2 className="max-w-[26rem] font-display text-[clamp(28px,6vw,42px)] leading-[1.05] tracking-[-0.015em] text-balance">
              {copy.features.heading}
            </h2>
          </Reveal>
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {copy.features.items.map((item, i) => (
              <Reveal
                as="li"
                key={item.title}
                delay={(i % 3) * 90}
                className="rounded-[22px] border border-white/7 bg-[#0c0c0f] p-6"
              >
                <h3 className="font-display text-[19px] leading-[1.2]">
                  {item.title}
                </h3>
                <p className="mt-2.5 text-[14.5px] leading-[1.6] text-pretty text-foreground/60">
                  {item.text}
                </p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* Same shape as the homepage FAQ — a rule, then serif questions — but
          scoped to this occasion. Repeating the homepage's eight here would
          be a page that answers nothing new. */}
      <section className="relative border-t border-border px-5 py-18 sm:px-6 lg:px-10 lg:py-20">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <div className="flex items-baseline justify-between gap-6 border-b border-white/11 pb-5">
              <h2 className="font-display text-[26px] leading-none tracking-[-0.015em] sm:text-[30px]">
                {en
                  ? `Questions about ${copy.label.toLowerCase()}`
                  : 'Gyakori kérdések'}
              </h2>
              <p className="font-mono text-[10px] font-medium tracking-[0.16em] text-foreground/38">
                {String(copy.faq.length).padStart(2, '0')}{' '}
                {en ? 'QUESTIONS' : 'KÉRDÉS'}
              </p>
            </div>
          </Reveal>
          <dl>
            {copy.faq.map(([question, answer], i) => (
              <Reveal
                key={question}
                delay={i * 60}
                className={`py-5.5 ${
                  i < copy.faq.length - 1 ? 'border-b border-white/11' : ''
                }`}
              >
                <dt className="font-display text-[19px] leading-[1.25]">
                  {question}
                </dt>
                <dd className="mt-2.5 text-[14.5px] leading-[1.6] text-pretty text-muted-foreground">
                  {answer}
                </dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>

      {posts.length > 0 ? (
        <section className="relative border-t border-border px-5 py-18 sm:px-6 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-5xl">
            <Reveal>
              <p className="font-mono text-[10px] font-medium tracking-[0.24em] text-accent">
                {en ? 'FROM THE BLOG' : 'A BLOGRÓL'}
              </p>
            </Reveal>
            <ul className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post, i) => (
                <Reveal as="li" key={post.id} delay={i * 90}>
                  <Link
                    href={post.href}
                    className="group flex h-full flex-col rounded-[22px] border border-white/7 bg-[#0c0c0f] p-6 transition-colors hover:border-white/16"
                  >
                    <h3 className="font-display text-[18px] leading-[1.25] text-balance">
                      {post.title}
                    </h3>
                    <p className="mt-2.5 line-clamp-3 text-[14px] leading-[1.6] text-pretty text-foreground/55">
                      {post.description}
                    </p>
                    <span
                      aria-hidden="true"
                      className="mt-4 inline-flex items-center gap-1.5 font-mono text-[9.5px] font-medium tracking-[0.16em] text-accent"
                    >
                      {en ? 'READ' : 'ELOLVASOM'}
                      <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="relative border-t border-border px-5 py-18 sm:px-6 lg:px-10 lg:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <h2 className="mx-auto max-w-[30rem] font-display text-[clamp(28px,6vw,42px)] leading-[1.05] tracking-[-0.015em] text-balance">
              {copy.cta.heading}
            </h2>
            <p className="mx-auto mt-4.5 max-w-[34rem] text-[15.5px] leading-[1.7] text-pretty text-foreground/60">
              {copy.cta.body}
            </p>
            <Link
              href={`${CREATE_EVENT_PATH}?lang=${locale}`}
              className={buttonVariants({ className: 'mt-8' })}
            >
              {copy.cta.button}
            </Link>
            <p className="mt-4 text-[13px] text-muted-foreground">
              {copy.cta.helper}
            </p>
          </Reveal>

          <OtherOccasions locale={locale} current={occasion.slug} />

          <BackLink
            href={localePath(locale, '/alkalmak')}
            className="mt-10 justify-center"
          >
            {en ? 'All occasions' : 'Minden alkalom'}
          </BackLink>
        </div>
      </section>
    </PageShell>
  )
}

/**
 * The other three occasions, as plain links.
 *
 * Revel carries a USE CASES dropdown on every page; we have four pages and a
 * navbar that deliberately drops the link while the section is draft, so the
 * cross-linking lives at the foot of each page instead. It costs one row and
 * it is the only thing making these four pages a set rather than four
 * orphans.
 */
function OtherOccasions({
  locale,
  current,
}: {
  locale: Locale
  current: string
}) {
  const others = occasions.filter((o) => o.slug !== current)

  return (
    <ul className="mt-12 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 border-t border-white/11 pt-7">
      {others.map((occasion) => (
        <li key={occasion.slug}>
          <Link
            href={localePath(locale, `/alkalmak/${occasion.slug}`)}
            className="inline-flex rounded-full border border-white/12 px-4 py-2 font-mono text-[9.5px] font-medium tracking-[0.16em] text-foreground/60 transition-colors hover:border-white/30 hover:text-foreground/90"
          >
            {occasionCopy(locale, occasion).label.toUpperCase()}
          </Link>
        </li>
      ))}
    </ul>
  )
}
