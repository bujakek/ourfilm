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

  const created = {
    ...input,
    kind: 'created' as const,
    captureEndAt: '2026-09-27T02:00:00Z',
    timeZone: 'Europe/Budapest',
    revealMode: 'event_end' as const,
    revealAt: '2026-09-27T02:00:00Z',
    guestsCanView: true,
  }

  it.each(['en', 'hu'] as const)(
    'confirms creation with localized links, event time and QR instructions (%s)',
    (locale) => {
      const email = renderEventEmail({ ...created, locale })
      expect(email.subject).toContain(
        locale === 'hu' ? 'Elkészült a kamerád' : 'Your camera is ready',
      )
      expect(email.text).toContain('04:00')
      expect(email.text).not.toContain('Europe/Budapest')
      expect(email.text).toContain(`/e/${input.slug}?lang=${locale}`)
      expect(email.html).toContain(`/host/events/${input.slug}?lang=${locale}`)
      expect(email.text).toContain(
        locale === 'hu' ? 'QR-kód gombbal' : 'QR code button',
      )
    },
  )

  it('describes instant reveal and private galleries truthfully', () => {
    const instant = renderEventEmail({ ...created, revealMode: 'instant' })
    expect(instant.text).toContain('see uploaded photos immediately')
    const privateGallery = renderEventEmail({
      ...created,
      guestsCanView: false,
    })
    expect(privateGallery.text).toContain('Only you can view the gallery')
    expect(privateGallery.text).not.toContain('revealed to your guests')
  })

  it('uses the actual reveal timestamp for legacy custom reveals', () => {
    const email = renderEventEmail({
      ...created,
      revealMode: 'custom',
      revealAt: '2026-09-28T10:00:00Z',
    })
    expect(email.text).toContain('28 Sept 2026, 12:00')
    expect(email.text).toContain('27 Sept 2026, 04:00')
  })

  it.each(['en', 'hu'] as const)(
    'includes the three practical reminder tips (%s)',
    (locale) => {
      const email = renderEventEmail({ ...input, locale, kind: 'upcoming' })
      expect(email.text).toContain(locale === 'hu' ? 'bárpultra' : 'at the bar')
      expect(email.text).toContain(
        locale === 'hu' ? 'Szólj róla' : 'Mention it',
      )
      expect(email.text).toContain(
        locale === 'hu' ? 'első képet' : 'first photo',
      )
    },
  )
})
