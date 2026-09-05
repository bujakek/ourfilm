import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  __resetTelemetryForTests,
  attachTelemetry,
  MASKED_TITLE,
  maskSlugs,
  sanitizeProperties,
  telemetryConfig,
  track,
  type TelemetryClient,
} from '@/lib/telemetry'

function client() {
  return { capture: vi.fn() } satisfies TelemetryClient
}

beforeEach(() => {
  __resetTelemetryForTests()
})

describe('buffering until the client loads', () => {
  it('replays, in order, what arrived before attach', () => {
    track('upload_restored', { event_id: 'ev', capture_id: 'a' })
    track('upload_confirmed', { event_id: 'ev', capture_id: 'a' })

    const c = client()
    attachTelemetry(c)

    expect(c.capture.mock.calls.map(([name]) => name)).toEqual([
      'upload_restored',
      'upload_confirmed',
    ])
    expect(c.capture).toHaveBeenNthCalledWith(
      1,
      'upload_restored',
      expect.objectContaining({ event_id: 'ev', capture_id: 'a' }),
      { send_instantly: true },
    )
  })

  it('sends straight through once attached', () => {
    const c = client()
    attachTelemetry(c)
    track('upload_dropped', {
      event_id: 'ev',
      capture_id: 'b',
      reason: 'exhausted',
    })

    expect(c.capture).toHaveBeenCalledOnce()
    expect(c.capture).toHaveBeenCalledWith(
      'upload_dropped',
      expect.objectContaining({ reason: 'exhausted' }),
      { send_instantly: true },
    )
  })

  it('does not grow without bound on a page that never gets a client', () => {
    for (let i = 0; i < 200; i++) {
      track('upload_refunded', { event_id: 'ev', capture_id: String(i) })
    }
    const c = client()
    attachTelemetry(c)
    expect(c.capture.mock.calls.length).toBeLessThanOrEqual(50)
  })
})

describe('masking the slug', () => {
  it('hides the guest route slug wherever it appears', () => {
    expect(maskSlugs('https://ourfilm.app/e/anna-peter-k3f9x7?lang=hu')).toBe(
      'https://ourfilm.app/e/[slug]?lang=hu',
    )
    expect(maskSlugs('/e/anna-peter-k3f9x7/camera')).toBe('/e/[slug]/camera')
  })

  it('hides the host event slug but not the fixed create route', () => {
    expect(maskSlugs('/host/events/anna-peter-k3f9x7/settings')).toBe(
      '/host/events/[slug]/settings',
    )
    expect(maskSlugs('/host/events/new')).toBe('/host/events/new')
    expect(maskSlugs('/host/events/new?lang=en')).toBe(
      '/host/events/new?lang=en',
    )
  })

  it('replaces the page title on event pages, and only there', () => {
    // Seen in the first live export: `$pageview` carried `document.title`,
    // which on a guest page is the host's event name.
    expect(
      sanitizeProperties({
        title: 'Anna és Péter esküvője — OurFilm',
        $current_url: 'http://ourfilm.app/e/anna-peter-k3f9x7?lang=hu',
      }),
    ).toEqual({
      title: MASKED_TITLE,
      $current_url: 'http://ourfilm.app/e/[slug]?lang=hu',
    })
    expect(
      sanitizeProperties({
        title: 'Esküvő beállításai — OurFilm',
        $pathname: '/host/events/anna-peter-k3f9x7/settings',
      }).title,
    ).toBe(MASKED_TITLE)
    expect(
      sanitizeProperties({
        title: 'Belépés — OurFilm',
        $pathname: '/host/login',
      }).title,
    ).toBe('Belépés — OurFilm')
  })

  it('runs over every string property, nested included', () => {
    const out = sanitizeProperties({
      $current_url: 'https://ourfilm.app/e/anna-peter-k3f9x7',
      $pathname: '/e/anna-peter-k3f9x7',
      $referrer: 'https://ourfilm.app/host/events/anna-peter-k3f9x7',
      $set_once: { $initial_pathname: '/e/anna-peter-k3f9x7' },
      shots_remaining: 3,
      online: true,
    })
    expect(out).toEqual({
      $current_url: 'https://ourfilm.app/e/[slug]',
      $pathname: '/e/[slug]',
      $referrer: 'https://ourfilm.app/host/events/[slug]',
      $set_once: { $initial_pathname: '/e/[slug]' },
      shots_remaining: 3,
      online: true,
    })
  })
})

describe('the conditions PostHog was adopted under', () => {
  // Each of these is a promise made in CLAUDE.md and on the privacy page.
  // Loosening one here is a product decision, not a config tweak.
  const config = telemetryConfig()

  it('stays in the EU, behind our own origin', () => {
    expect(config.api_host).toBe('/ingest')
    expect(config.ui_host).toBe('https://eu.posthog.com')
  })

  it('writes nothing to the device', () => {
    expect(config.cookieless_mode).toBe('always')
    expect(config.persistence).toBe('memory')
  })

  it('records no sessions and captures nothing on its own', () => {
    expect(config.disable_session_recording).toBe(true)
    expect(config.autocapture).toBe(false)
    expect(config.capture_heatmaps).toBe(false)
    expect(config.capture_dead_clicks).toBe(false)
    expect(config.disable_surveys).toBe(true)
    expect(config.disable_external_dependency_loading).toBe(true)
  })

  it('masks every URL it sends', () => {
    expect(config.sanitize_properties).toBe(sanitizeProperties)
  })
})
