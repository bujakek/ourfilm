import { describe, expect, it } from 'vitest'

import { EXAMPLE_SLUG, generateEventSlug } from '@/lib/slug'

/**
 * The slug is the only thing between a wedding album and anyone who fancies
 * guessing at it: no login, no passcode, no gate. Each expectation here is one
 * property that keeps that true, so weakening one has to be a decision someone
 * makes on purpose rather than a refactor nobody noticed.
 */
describe('generateEventSlug', () => {
  const ALLOWED = /^[23456789abcdefghjkmnpqrstvwxyz]{10}$/

  it('is ten characters from the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateEventSlug()).toMatch(ALLOWED)
    }
  })

  it('excludes every confusable character', () => {
    // `0`/`o`, `1`/`l`/`i` are misread off a card in dim light, and `u` turns
    // random strings into words nobody wants printed on an invitation.
    const slugs = Array.from({ length: 500 }, () => generateEventSlug()).join(
      '',
    )
    expect(slugs).not.toMatch(/[01oliu]/)
  })

  it('is unpredictable', () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateEventSlug()))
    expect(seen.size).toBe(500)
  })

  it('carries nothing of the event name', () => {
    // The signature takes no argument at all, which is the real guarantee;
    // this is the behavioural half of it.
    const slugs = Array.from({ length: 200 }, () => generateEventSlug())
    expect(slugs.some((slug) => slug.includes('-'))).toBe(false)
  })

  it('advertises the shape a host is really given', () => {
    // A marketing mockup showing a name-shaped URL would teach hosts to expect
    // a link the create flow will never mint.
    expect(EXAMPLE_SLUG).toMatch(ALLOWED)
  })
})
