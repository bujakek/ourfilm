import { generateMetadata as alternativesMetadata } from '@/app/[locale]/alternativak/page'
import { generateMetadata as pricingMetadata } from '@/app/[locale]/arak/page'
import { generateMetadata as termsMetadata } from '@/app/[locale]/aszf/page'
import { generateMetadata as privacyMetadata } from '@/app/[locale]/adatvedelem/page'
import { generateMetadata as blogMetadata } from '@/app/[locale]/blog/page'
import { generateMetadata as legalMetadata } from '@/app/[locale]/impresszum/page'
import sitemap from '@/app/sitemap'
import { getAllDocs, getTranslations } from '@/lib/content/docs'
import { contentMetadata } from '@/lib/content/metadata'
import {
  localePath,
  locales,
  localeTag,
  translatedMarketingPath,
} from '@/lib/i18n'
import {
  canonicalUrl,
  localizedPageAlternates,
  localizedPageLanguages,
} from '@/lib/seo'
import type { Metadata } from 'next'
import { describe, expect, it } from 'vitest'
import nextConfig from '../../next.config.mjs'

const translatedStaticPages = [
  { path: '/arak', metadata: pricingMetadata },
  { path: '/aszf', metadata: termsMetadata },
  { path: '/adatvedelem', metadata: privacyMetadata },
  { path: '/impresszum', metadata: legalMetadata },
  { path: '/blog', metadata: blogMetadata },
  { path: '/alternativak', metadata: alternativesMetadata },
] as const

describe('international locale targeting', () => {
  it('targets global English instead of one English-speaking country', () => {
    expect(localeTag.en).toBe('en')
    expect(localeTag.hu).toBe('hu-HU')
  })

  it('builds one reciprocal alternate cluster with Hungarian as x-default', () => {
    expect(localizedPageLanguages('/arak')).toEqual({
      en: canonicalUrl('/en/pricing'),
      'hu-HU': canonicalUrl('/hu/arak'),
      'x-default': canonicalUrl('/hu/arak'),
    })
    expect(localizedPageAlternates('en', '/arak')).toEqual({
      canonical: canonicalUrl('/en/pricing'),
      languages: localizedPageLanguages('/arak'),
    })
  })
})

describe('same-page language switching', () => {
  it.each([
    ['/en', 'hu', '/hu'],
    ['/hu', 'en', '/en'],
    ['/en/pricing', 'hu', '/hu/arak'],
    ['/hu/arak', 'en', '/en/pricing'],
    ['/en/alternatives', 'hu', '/hu/alternativak'],
    ['/hu/alternativak', 'en', '/en/alternatives'],
    ['/en/blog', 'hu', '/hu/blog'],
    ['/hu/blog', 'en', '/en/blog'],
    ['/en/early-couple-program', 'hu', '/hu/early-couple-program'],
  ] as const)('%s switches to %s at %s', (source, locale, destination) => {
    expect(translatedMarketingPath(source, locale)).toBe(destination)
  })

  it('never invents a translated article slug', () => {
    expect(translatedMarketingPath('/en/blog/an-english-slug', 'hu')).toBe(
      '/hu',
    )
    expect(translatedMarketingPath('/hu/osszehasonlitas', 'en')).toBe('/en')
  })

  it('permanently redirects every wrong-language marketing alias', async () => {
    const redirects = await nextConfig.redirects!()
    const pathPairs = [
      ['/arak', '/pricing'],
      ['/alkalmak', '/occasions'],
      ['/rolunk', '/about'],
      ['/kapcsolat', '/contact'],
      ['/alternativak', '/alternatives'],
      ['/osszehasonlitas', '/comparisons'],
      ['/aszf', '/terms'],
      ['/adatvedelem', '/privacy'],
      ['/impresszum', '/legal'],
    ] as const

    for (const [hungarian, english] of pathPairs) {
      expect(redirects).toContainEqual({
        source: `/en${hungarian}`,
        destination: `/en${english}`,
        permanent: true,
      })
      expect(redirects).toContainEqual({
        source: `/hu${english}`,
        destination: `/hu${hungarian}`,
        permanent: true,
      })
    }
  })
})

describe('translated static page metadata', () => {
  it.each(translatedStaticPages)(
    '$path has a self-canonical and identical reciprocal hreflang',
    async ({ path, metadata }) => {
      for (const locale of locales) {
        const result = (await metadata({
          params: Promise.resolve({ locale }),
        })) as Metadata

        expect(result.alternates?.canonical).toBe(
          canonicalUrl(localePath(locale, path)),
        )
        expect(result.alternates?.languages).toEqual(
          localizedPageLanguages(path),
        )
      }
    },
  )
})

describe('international sitemap parity', () => {
  const entries = sitemap()

  it.each([
    '/',
    '/arak',
    '/aszf',
    '/adatvedelem',
    '/impresszum',
    '/blog',
    '/alternativak',
  ])('lists both versions of %s in one reciprocal cluster', (path) => {
    const expectedLanguages = localizedPageLanguages(path)

    for (const locale of locales) {
      const url = canonicalUrl(localePath(locale, path))
      const entry = entries.find((candidate) => candidate.url === url)
      expect(entry, url).toBeDefined()
      expect(entry?.alternates?.languages).toEqual(expectedLanguages)
    }
  })

  it('makes every hreflang cluster reciprocal and self-referential', () => {
    for (const entry of entries) {
      const languages = entry.alternates?.languages
      if (!languages) continue

      expect(Object.values(languages), entry.url).toContain(entry.url)
      for (const translatedUrl of Object.values(languages)) {
        if (translatedUrl === languages['x-default']) continue
        const translatedEntry = entries.find(
          (candidate) => candidate.url === translatedUrl,
        )
        expect(translatedEntry, translatedUrl).toBeDefined()
        expect(translatedEntry?.alternates?.languages).toEqual(languages)
      }
    }
  })
})

describe('content translation identity', () => {
  const docs = getAllDocs()
  // Independently researched market-specific articles are not translations.
  // Keep the bilingual contract for every existing pair, and require an
  // explicit, reviewed exception instead of joining unrelated pages by id.
  const marketSpecificLocales: Record<string, string[]> = {
    'how-many-disposable-cameras-wedding': ['en'],
    'phone-free-wedding-ceremony': ['hu'],
  }

  it.each([...new Set(docs.map((doc) => doc.id))])(
    '%s has exactly its intended locales',
    (id) => {
      expect(
        docs
          .filter((doc) => doc.id === id)
          .map((doc) => doc.locale)
          .sort(),
      ).toEqual(marketSpecificLocales[id] ?? ['en', 'hu'])
    },
  )

  it.each(Object.entries(marketSpecificLocales))(
    '%s never advertises an unrelated page as its translation',
    (id, expectedLocales) => {
      expect(Object.keys(getTranslations(id)).sort()).toEqual(expectedLocales)
      const doc = docs.find((candidate) => candidate.id === id)
      expect(doc).toBeDefined()
      const alternates = contentMetadata(doc!).alternates
      expect(alternates?.canonical).toBe(canonicalUrl(doc!.href))
      expect(alternates?.languages).toEqual({})
    },
  )
})
