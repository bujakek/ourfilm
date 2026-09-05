import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  __resetTelemetryForTests,
  attachTelemetry,
  MASKED_TITLE,
  maskSlugs,
  safeErrorStack,
  sanitizeEvent,
  sanitizeProperties,
  stripQueryAndHash,
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
    track('upload_restored', {
      event_id: 'ev',
      capture_id: 'a',
      age_ms: 1_000,
    })
    track('upload_confirmed', {
      event_id: 'ev',
      capture_id: 'a',
      shots_remaining: 2,
      elapsed_ms: 900,
    })

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
    )
  })

  it('batches routine events and sends rare failures immediately', () => {
    const c = client()
    attachTelemetry(c)
    track('upload_discarded', {
      event_id: 'ev',
      capture_id: 'b',
      reason: 'exhausted',
      age_ms: 2_000,
    })
    track(
      'upload_issue',
      {
        event_id: 'ev',
        capture_id: 'b',
        stage: 'upload',
        failure: 'http_503',
        attempts: 1,
        terminal: false,
      },
      { urgent: true },
    )

    expect(c.capture).toHaveBeenNthCalledWith(
      1,
      'upload_discarded',
      expect.objectContaining({ reason: 'exhausted' }),
    )
    expect(c.capture).toHaveBeenNthCalledWith(
      2,
      'upload_issue',
      expect.objectContaining({ failure: 'http_503' }),
      { send_instantly: true },
    )
  })

  it('does not grow without bound on a page that never gets a client', () => {
    for (let i = 0; i < 200; i++) {
      track('upload_restored', {
        event_id: 'ev',
        capture_id: String(i),
        age_ms: 1_000,
      })
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
      $current_url: 'http://ourfilm.app/e/[slug]',
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

  it('removes complete URL queries and fragments, including magic links', () => {
    expect(stripQueryAndHash('/auth/callback?code=secret#still-secret')).toBe(
      '/auth/callback',
    )
    expect(
      sanitizeProperties({
        $current_url:
          'https://ourfilm.app/auth/callback?code=secret&next=/host#token',
        url: 'https://ourfilm.app/e/private-slug?token_hash=secret',
      }),
    ).toEqual({
      $current_url: 'https://ourfilm.app/auth/callback',
      url: 'https://ourfilm.app/e/[slug]',
    })
  })

  it('sanitizes the whole event before PostHog sends it', () => {
    expect(
      sanitizeEvent({
        event: 'client_error',
        properties: {
          $pathname: '/host/events/private-slug?code=secret',
        },
      }),
    ).toEqual({
      event: 'client_error',
      properties: { $pathname: '/host/events/[slug]' },
    })
  })

  it('keeps error locations while redacting messages and URL secrets', () => {
    const error = new TypeError('guest name and token should not leave')
    error.stack = [
      'TypeError: guest name and token should not leave',
      'secret continuation email@example.com',
      '    at submit (https://ourfilm.app/e/private-slug?code=secret:2:3)',
    ].join('\n')

    expect(safeErrorStack(error)).toBe(
      [
        'TypeError: [redacted]',
        '    at submit (https://ourfilm.app/e/[slug])',
      ].join('\n'),
    )
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
    expect(config.disable_web_experiments).toBe(true)
    expect(config.disable_external_dependency_loading).toBe(true)
    expect(config.capture_exceptions).toBe(false)
    expect(config.capture_performance).toBe(false)
    expect(config.capture_pageview).toBe(false)
    expect(config.capture_pageleave).toBe(false)
    expect(config.save_campaign_params).toBe(false)
    expect(config.save_referrer).toBe(false)
    expect(config.advanced_disable_flags).toBe(true)
    expect(config.logs).toEqual({ captureConsoleLogs: false })
  })

  it('masks every URL it sends', () => {
    expect(config.before_send).toBe(sanitizeEvent)
  })

  it('never creates person profiles', () => {
    expect(config.person_profiles).toBe('never')
  })
})
