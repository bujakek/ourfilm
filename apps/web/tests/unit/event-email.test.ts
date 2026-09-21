import { describe, expect, it } from 'vitest'
import { renderEventEmail } from '@/lib/email/event-email'

describe('host event emails', () => {
  const input = {
    locale: 'en' as const,
    eventName: 'Anna & Peter',
    slug: 'anna-peter-abc123',
    photoCount: 42,
  }

  it('includes the localized guest link and host QR destination', () => {
    const email = renderEventEmail({ ...input, kind: 'upcoming' })
    expect(email.text).toContain('print your QR codes')
    expect(email.text).toContain('/e/anna-peter-abc123?lang=en')
    expect(email.html).toContain('/host/events/anna-peter-abc123?lang=en')
    expect(email.html).toContain('Anna &amp; Peter')
  })

  it.each([0, 1, 42])('reports %i received photos honestly', (photoCount) => {
    const email = renderEventEmail({ ...input, kind: 'ended', photoCount })
    expect(email.text).toContain(
      photoCount === 0
        ? 'No photos have reached'
        : `${photoCount} ${photoCount === 1 ? 'photo has' : 'photos have'} reached`,
    )
    expect(email.text).toContain('Photos may still arrive')
    expect(email.text).toContain('chosen reveal time')
  })

  it('renders Hungarian copy and links using the event locale', () => {
    for (const kind of ['upcoming', 'ended'] as const) {
      const email = renderEventEmail({ ...input, kind, locale: 'hu' })
      expect(email.html).toContain('<html lang="hu">')
      expect(email.text).toContain('?lang=hu')
      expect(email.text).not.toContain('?lang=en')
      expect(email.text).toContain('házigazdája')
    }
  })

  it('escapes host-supplied event names', () => {
    const email = renderEventEmail({
      ...input,
      kind: 'upcoming',
      eventName: '<img src=x onerror=alert(1)>',
    })
    expect(email.html).not.toContain('<img src=x')
    expect(email.html).toContain('&lt;img')
  })
})
