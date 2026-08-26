/**
 * The places the legal work has to be wired in, checked at the source.
 *
 *     pnpm test
 *
 * These are source-text assertions, which is unusual here and deliberate. The
 * properties below are not expressible as a function call — "the checkbox is
 * not pre-ticked", "the camera is gated on an acknowledgement", "the route
 * exists" — but each of them is a single edit away from silently regressing,
 * and each of them is a legal defect rather than a bug when it does. A brittle
 * test that fails loudly on a real change is the right trade for that.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { emptyDraft } from '@/lib/event-draft'
import {
  INDEXABLE_LEGAL_ROUTES,
  LEGAL_PATHS,
  legalHref,
  type LegalRoute,
} from '@/lib/legal/routes'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

const pagePath = (route: LegalRoute) =>
  `app/[locale]${LEGAL_PATHS[route]}/page.tsx`

describe('routes', () => {
  it('every legal path has a page behind it', () => {
    for (const route of Object.keys(LEGAL_PATHS) as LegalRoute[]) {
      expect(existsSync(join(root, pagePath(route))), pagePath(route)).toBe(
        true,
      )
    }
  })

  it('uses the Hungarian addresses the ÁSZF and the footer name', () => {
    expect(LEGAL_PATHS).toEqual({
      imprint: '/impresszum',
      terms: '/aszf',
      privacy: '/adatvedelem',
      guestTerms: '/vendegfeltetelek',
      processing: '/adatfeldolgozasi-melleklet',
      withdrawal: '/elallas',
      report: '/jogserto-tartalom-bejelentese',
    })
    expect(legalHref('hu', 'withdrawal')).toBe('/hu/elallas')
  })

  it('the ÁSZF points at the two form routes by their real addresses', () => {
    // Both are spelled out in the approved copy. A document that names a route
    // which does not exist is worse than an ordinary broken link: it is the
    // route someone reaches for when something has already gone wrong.
    const terms = read(pagePath('terms'))
    expect(terms).toBeTruthy()
    const copy = read('lib/legal/copy/aszf.ts')
    expect(copy).toContain(LEGAL_PATHS.withdrawal)
    expect(copy).toContain(LEGAL_PATHS.report)
  })

  it('the information pages are indexable once the identifiers are real', () => {
    for (const route of INDEXABLE_LEGAL_ROUTES) {
      expect(read(pagePath(route))).toContain(
        'robots: { index: hasCompleteLegalConfig(), follow: true }',
      )
    }
  })

  it('the two form pages stay out of the index regardless', () => {
    for (const route of ['withdrawal', 'report'] as const) {
      expect(read(pagePath(route))).toContain('robots: { index: false')
    }
    expect(INDEXABLE_LEGAL_ROUTES).not.toContain('withdrawal')
    expect(INDEXABLE_LEGAL_ROUTES).not.toContain('report')
  })

  it('the footer links all seven', () => {
    const footer = read('components/site/footer.tsx')
    for (const route of Object.keys(LEGAL_PATHS) as LegalRoute[]) {
      expect(footer).toContain(`LEGAL_PATHS.${route}`)
    }
  })
})

describe('checkout declarations are never pre-ticked', () => {
  it('both start false in the create flow', () => {
    const form = read('app/host/events/new/new-event-form.tsx')
    expect(form).toContain(
      'const [acceptedTerms, setAcceptedTerms] = useState(false)',
    )
    expect(form).toMatch(
      /const \[acceptedEarlyPerformance, setAcceptedEarlyPerformance\] =\s*useState\(false\)/,
    )
  })

  it('both start false on the billing card', () => {
    const card = read('components/host/billing-card.tsx')
    expect(card).toContain(
      'const [acceptedTerms, setAcceptedTerms] = useState(false)',
    )
    expect(card).toMatch(
      /const \[acceptedEarlyPerformance, setAcceptedEarlyPerformance\] =\s*useState\(false\)/,
    )
  })

  it('both start false after the magic-link round trip', () => {
    // The declarations are deliberately not carried in the draft, so the
    // resume screen asks again rather than replaying a consent nobody made at
    // the moment the contract formed.
    const resume = read('app/auth/event-complete/complete-creation.tsx')
    expect(resume).toContain(
      'const [acceptedTerms, setAcceptedTerms] = useState(false)',
    )
  })

  it('the checkboxes are controlled and never defaulted on', () => {
    const consent = read('components/host/legal-consent.tsx')
    expect(consent).not.toContain('defaultChecked')
    expect(consent).toContain('checked={checked}')
  })

  it('the server refuses a creation without both declarations', () => {
    // A disabled button is a courtesy; this is the refusal.
    const action = read('app/host/events/new/actions.ts')
    expect(action).toContain(
      'input.acceptedTerms !== true || input.acceptedEarlyPerformance !== true',
    )
    const billing = read('app/host/events/[slug]/billing-actions.ts')
    expect(billing).toContain('!acceptedTerms || !acceptedEarlyPerformance')
  })
})

describe('a local draft is not a contract', () => {
  it('carries no acceptance of any kind', () => {
    // The whole trade the signed-out create flow is built on: answers in the
    // browser, nothing in the database, and no declaration recorded until
    // there is a row to attach it to.
    const draft = emptyDraft(
      new Date('2026-08-26T10:00:00.000Z'),
      'Europe/Budapest',
      '00000000-0000-4000-8000-000000000000',
    )
    for (const key of Object.keys(draft)) {
      expect(key.toLowerCase()).not.toContain('accept')
      expect(key.toLowerCase()).not.toContain('consent')
      expect(key.toLowerCase()).not.toContain('legal')
    }
  })

  it('holds a plan that is a wish rather than an entitlement', () => {
    const draft = emptyDraft(
      new Date('2026-08-26T10:00:00.000Z'),
      'Europe/Budapest',
      '00000000-0000-4000-8000-000000000000',
    )
    expect(draft.plan).toBe('free')
  })
})

describe('the guest acknowledgement', () => {
  it('gates the camera rather than sitting beside it', () => {
    const page = read('app/e/[slug]/camera/page.tsx')
    expect(page).toContain('hasGuestAcceptance')
    expect(page).toContain('<GuestAcknowledgement')
  })

  it('starts unticked and disables the button until it is ticked', () => {
    const component = read('components/event/guest-acknowledgement.tsx')
    expect(component).toContain('useState(false)')
    expect(component).toContain('disabled={!accepted || pending}')
  })

  it('the join screen shows the privacy notice before the name is sent', () => {
    // Joining is the first thing this product ever sends to a server on a
    // guest's behalf.
    const form = read('components/event/join-form.tsx')
    expect(form).toContain('<PrivacyNoticeLine')
  })
})

describe('hidden is not deleted', () => {
  it('moderation says rejtve and never claims a deletion', () => {
    const grid = read('components/host/moderation-grid.tsx')
    expect(grid).toContain('rejtve')
    expect(grid).not.toMatch(/tör(öl|lőd)/)
  })

  it('the hide action is a soft delete and says so', () => {
    const actions = read('app/host/events/[slug]/actions.ts')
    expect(actions).toContain('hidden_at')
    expect(actions).toContain('Soft delete only')
  })
})

describe('the retention endpoint', () => {
  const route = read('app/api/retention/run/route.ts')

  it('fails closed when no secret is configured', () => {
    expect(route).toContain('RETENTION_CRON_SECRET')
    expect(route).toContain('status: 503')
  })

  it('is POST only', () => {
    // A GET that permanently deletes albums is one a link prefetcher can fire.
    expect(route).toContain('export async function POST')
    expect(route).not.toContain('export async function GET')
  })

  it('is scheduled in vercel.json', () => {
    expect(read('vercel.json')).toContain('/api/retention/run')
  })
})

describe('no withdrawn EU dispute platform anywhere in the source', () => {
  it('is absent from the legal copy modules', () => {
    for (const file of [
      'lib/legal/copy/aszf.ts',
      'lib/legal/copy/adatvedelem.ts',
      'lib/legal/copy/impresszum.ts',
      'lib/legal/copy/vendegfeltetelek.ts',
      'lib/legal/copy/adatfeldolgozasi-melleklet.ts',
      'components/site/faq.tsx',
    ]) {
      expect(read(file).toLowerCase()).not.toContain('ec.europa.eu/odr')
      expect(read(file)).not.toMatch(/online vitarendezés/i)
    }
  })
})
