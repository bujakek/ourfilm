import sitemap from '@/app/sitemap'
import { occasionBySlug, occasionPath, occasions } from '@/lib/occasions'
import { canonicalUrl } from '@/lib/seo'
import { describe, expect, it } from 'vitest'
import nextConfig from '../../next.config.mjs'

const expectedSlugs = {
  wedding: { en: 'wedding', hu: 'eskuvo' },
  birthday: { en: 'birthday', hu: 'szuletesnap' },
  travel: { en: 'travel', hu: 'utazas' },
  party: { en: 'party', hu: 'buli' },
} as const

describe('occasion routes', () => {
  it('gives every occasion a slug in the language of its URL', () => {
    expect(
      Object.fromEntries(
        occasions.map((occasion) => [occasion.id, occasion.slugs]),
      ),
    ).toEqual(expectedSlugs)

    for (const occasion of occasions) {
      expect(occasionPath('en', occasion)).toBe(
        `/en/occasions/${occasion.slugs.en}`,
      )
      expect(occasionPath('hu', occasion)).toBe(
        `/hu/alkalmak/${occasion.slugs.hu}`,
      )
      expect(occasionBySlug('en', occasion.slugs.en)).toBe(occasion)
      expect(occasionBySlug('hu', occasion.slugs.hu)).toBe(occasion)
      expect(occasionBySlug('en', occasion.slugs.hu)).toBeUndefined()
      expect(occasionBySlug('hu', occasion.slugs.en)).toBeUndefined()
    }
  })

  it('publishes only canonical localized occasion URLs in the sitemap', () => {
    const entries = sitemap()
    const urls = entries.map((entry) => entry.url)

    for (const occasion of occasions) {
      const english = canonicalUrl(occasionPath('en', occasion))
      const hungarian = canonicalUrl(occasionPath('hu', occasion))
      const englishEntry = entries.find((entry) => entry.url === english)
      const hungarianEntry = entries.find((entry) => entry.url === hungarian)

      expect(englishEntry?.alternates?.languages).toEqual({
        en: english,
        'hu-HU': hungarian,
        'x-default': hungarian,
      })
      expect(hungarianEntry?.alternates?.languages).toEqual(
        englishEntry?.alternates?.languages,
      )
      expect(urls).not.toContain(
        canonicalUrl(`/en/occasions/${occasion.slugs.hu}`),
      )
    }
  })

  it('permanently redirects every previously published English slug', async () => {
    const redirects = await nextConfig.redirects!()

    for (const occasion of occasions) {
      const destination = occasionPath('en', occasion)
      expect(redirects).toContainEqual({
        source: `/en/occasions/${occasion.slugs.hu}`,
        destination,
        permanent: true,
      })
      expect(redirects).toContainEqual({
        source: `/en/alkalmak/${occasion.slugs.hu}`,
        destination,
        permanent: true,
      })
    }
  })
})
