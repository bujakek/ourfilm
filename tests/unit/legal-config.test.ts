/**
 * The central legal configuration, and the promise it makes: a value nobody
 * supplied is visibly missing rather than plausibly wrong.
 *
 *     pnpm test
 *
 * Offline. Nothing here touches the database or the network.
 */
import { describe, expect, it } from 'vitest'

import {
  formatHuf,
  hasCompleteLegalConfig,
  isMissing,
  LEGAL_EFFECTIVE_LABEL,
  LEGAL_VERSION,
  legalBlockers,
  legalConfig,
  legalText,
  MISSING,
  MISSING_LABEL,
  type LegalConfig,
} from '@/lib/legal/config'
import { EVENT_PRICE_LABEL } from '@/lib/pricing'

describe('legal version', () => {
  it('is the version this change stamps on every acceptance record', () => {
    expect(LEGAL_VERSION).toBe('2026-08-26')
  })

  it('reads back to a Hungarian visitor as the same date', () => {
    expect(LEGAL_EFFECTIVE_LABEL).toBe('Hatályos: 2026. augusztus 26.')
  })
})

describe('missing values', () => {
  it('renders as a sentence a reader cannot mistake for copy', () => {
    expect(legalText(MISSING)).toBe(MISSING_LABEL)
    expect(MISSING_LABEL).toBe('HIÁNYZÓ KÖTELEZŐ ADAT')
  })

  it('passes a real value through untouched', () => {
    expect(legalText('Példa Péter e.v.')).toBe('Példa Péter e.v.')
  })

  it('is a symbol, so a template cannot interpolate it by accident', () => {
    // The whole reason this is not `null` or `''`. A careless
    // `${config.provider.legalName}` would print "Symbol(...)" — ugly, and
    // impossible to mistake for a name — where an empty string would silently
    // read as "the provider has no name".
    expect(isMissing(MISSING)).toBe(true)
    expect(typeof MISSING).toBe('symbol')
  })
})

describe('launch blockers', () => {
  const blockers = legalBlockers()

  it('reports every mandatory identifier nobody has supplied', () => {
    const paths = blockers.map((b) => b.path)
    for (const path of [
      'provider.legalName',
      'provider.registeredSeat',
      'provider.mailingAddress',
      'provider.registrationNumber',
      'provider.taxNumber',
      'provider.phone',
      'hostingProvider.email',
      'supervisoryAuthority.name',
      'conciliationBody.name',
    ]) {
      expect(paths).toContain(path)
    }
  })

  it('flags an EEA transfer with no verified safeguard', () => {
    const transfers = blockers.filter((b) =>
      b.path.startsWith('subprocessors['),
    )
    expect(transfers.map((b) => b.path).join(' ')).toContain('Vercel')
    expect(transfers.map((b) => b.path).join(' ')).toContain('Resend')
  })

  it('does not flag a transfer that stays inside the EEA', () => {
    expect(blockers.map((b) => b.path).join(' ')).not.toContain('Stripe')
  })

  it('every blocker explains itself', () => {
    for (const blocker of blockers) {
      expect(blocker.reason.length).toBeGreaterThan(20)
    }
  })

  it('keeps the pages out of search while any remain', () => {
    expect(blockers.length).toBeGreaterThan(0)
    expect(hasCompleteLegalConfig()).toBe(false)
  })

  it('clears once every value is supplied', () => {
    // The property that matters: this is a list that can actually reach zero,
    // not a permanently-red flag someone will learn to ignore.
    const filled: LegalConfig = {
      ...legalConfig,
      provider: {
        displayName: 'OurFilm',
        legalName: 'Példa Péter e.v.',
        legalForm: 'egyéni vállalkozó',
        registeredSeat: '1111 Budapest, Példa utca 1.',
        mailingAddress: '1111 Budapest, Példa utca 1.',
        registrationNumber: '12345678',
        taxNumber: '12345678-1-42',
        registryAuthority: 'Egyéni Vállalkozók Nyilvántartása (EVNY)',
        email: 'hello@example.com',
        phone: '+36 1 234 5678',
      },
      hostingProvider: {
        name: 'Vercel Inc.',
        registeredSeat: 'Walnut, CA, USA',
        email: 'privacy@example.com',
      },
      supervisoryAuthority: {
        name: 'Hatóság',
        seat: 'Budapest',
        mailingAddress: 'Budapest, Pf. 1.',
        website: 'https://example.hu',
        phone: '+36 1 111 1111',
      },
      consumerProtectionAuthority: {
        name: 'Kormányhivatal',
        website: 'https://example.hu',
      },
      conciliationBody: {
        name: 'Békéltető Testület',
        seat: 'Budapest',
        website: 'https://example.hu',
        email: 'bekelteto@example.hu',
      },
      service: { ...legalConfig.service, securityLogRetentionDays: 30 },
      subprocessors: legalConfig.subprocessors.map((sub) => ({
        ...sub,
        transferBasis: isMissing(sub.transferBasis ?? '')
          ? 'Általános szerződési feltételek (SCC)'
          : sub.transferBasis,
      })),
    }

    expect(legalBlockers(filled)).toEqual([])
    expect(hasCompleteLegalConfig(filled)).toBe(true)
  })
})

describe('price', () => {
  it('is the one the ÁSZF quotes and the one the product shows', () => {
    // The specific failure this prevents: a screen offering an event for one
    // amount while the contract behind the button names another.
    expect(EVENT_PRICE_LABEL).toBe(formatHuf(legalConfig.service.priceHuf))
    expect(legalConfig.service.priceHuf).toBe(12_900)
  })

  it('is set the way a Hungarian price is', () => {
    // A non-breaking space between the groups, so "12 900 Ft" never wraps.
    expect(formatHuf(12_900)).toBe('12 900 Ft')
  })
})

describe('service facts', () => {
  it('mirrors the shot limits the database constraint enforces', () => {
    expect(legalConfig.service.shotLimitOptions).toEqual([5, 10, 16, 24, 36])
  })

  it('states the retention rule the ÁSZF and the retention run share', () => {
    expect(legalConfig.service.activeAlbumMonths).toBe(6)
    expect(legalConfig.service.deletionWarningDays).toBe(30)
  })

  it('claims no backup cycle until one is verified', () => {
    // Section 9's backup paragraph is conditional on this. Undefined means the
    // ÁSZF simply makes no claim, which beats a guessed number.
    expect(legalConfig.service.backupDeletionDays).toBeUndefined()
  })
})
