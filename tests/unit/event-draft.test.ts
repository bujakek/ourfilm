import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearDraft,
  DRAFT_KEY,
  DRAFT_TTL_DAYS,
  draftHasAnswers,
  draftIsFresh,
  emptyDraft,
  loadDraft,
  saveDraft,
  type EventDraft,
} from '@/lib/event-draft'

const NOW = new Date('2026-08-26T10:00:00Z')
const KEY = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The suite runs in node, where there is no `window`. A map is enough: the
 * module only ever calls getItem/setItem/removeItem, and what is being tested
 * is the parsing and the lifecycle, not the browser's storage.
 */
class MemoryStorage {
  store = new Map<string, string>()
  getItem(key: string) {
    return this.store.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.store.set(key, value)
  }
  removeItem(key: string) {
    this.store.delete(key)
  }
}

let storage: MemoryStorage

beforeEach(() => {
  storage = new MemoryStorage()
  // @ts-expect-error — a deliberate stand-in for the browser global.
  globalThis.window = { localStorage: storage }
})

function draft(overrides: Partial<EventDraft> = {}): EventDraft {
  return { ...emptyDraft(NOW, 'Europe/Budapest', KEY), ...overrides }
}

describe('saving and reading a draft', () => {
  it('round-trips every answer', () => {
    const original = draft({
      name: 'Az esküvőnk',
      endLocal: '2026-08-27T23:30',
      revealMode: 'custom',
      delayDays: 3,
      shots: 36,
      plan: 'full',
      guestsCanView: false,
      step: 3,
    })
    saveDraft(original, NOW)

    const read = loadDraft(NOW)
    expect(read).not.toBeNull()
    expect(read).toMatchObject({
      name: 'Az esküvőnk',
      endLocal: '2026-08-27T23:30',
      revealMode: 'custom',
      delayDays: 3,
      shots: 36,
      plan: 'full',
      guestsCanView: false,
      step: 3,
      creationKey: KEY,
    })
  })

  it('stamps updatedAt on every save, so the TTL measures inactivity', () => {
    saveDraft(draft({ name: 'A' }), NOW)
    const later = new Date(NOW.getTime() + 3 * DAY_MS)
    saveDraft(draft({ name: 'B' }), later)
    expect(loadDraft(later)?.updatedAt).toBe(later.toISOString())
  })

  it('returns null when nothing was ever saved', () => {
    expect(loadDraft(NOW)).toBeNull()
  })

  it('carries the pending-create intent across the auth round trip', () => {
    // The one flag that has to survive a page the browser leaves entirely.
    saveDraft(draft({ name: 'A', pendingCreate: true }), NOW)
    expect(loadDraft(NOW)?.pendingCreate).toBe(true)
  })
})

describe('a draft that cannot be trusted', () => {
  it('ignores and clears unparseable JSON', () => {
    storage.setItem(DRAFT_KEY, '{not json')
    expect(loadDraft(NOW)).toBeNull()
    expect(storage.getItem(DRAFT_KEY)).toBeNull()
  })

  it('refuses a shot count outside the five allowed rolls', () => {
    // The store is a JSON blob any visitor can edit. This is the first of two
    // refusals — the server re-validates the same value at creation, because a
    // form is a courtesy and the database is the rule.
    saveDraft({ ...draft(), shots: 7 as never }, NOW)
    expect(loadDraft(NOW)).toBeNull()
  })

  it('refuses a reveal mode that is not one of the three', () => {
    saveDraft({ ...draft(), revealMode: 'whenever' as never }, NOW)
    expect(loadDraft(NOW)).toBeNull()
  })

  it('refuses a delay outside 1–30 days', () => {
    for (const days of [0, -3, 31, 900]) {
      saveDraft({ ...draft(), delayDays: days }, NOW)
      expect(loadDraft(NOW)).toBeNull()
    }
  })

  it('refuses a plan that is neither free nor full', () => {
    saveDraft({ ...draft(), plan: 'admin' as never }, NOW)
    expect(loadDraft(NOW)).toBeNull()
  })

  it('refuses a creation key that is not a uuid', () => {
    // Anything goes here would be a key a visitor could collide with someone
    // else's on purpose.
    saveDraft({ ...draft(), creationKey: 'mine' }, NOW)
    expect(loadDraft(NOW)).toBeNull()
  })

  it('ignores extra fields rather than trusting them', () => {
    // Notably: nothing in the store can carry an entitlement. A hand-written
    // `paid: true` is read as noise, and `plan: "full"` is only ever a wish —
    // the cap is lifted by a paid purchases row, never by this file.
    saveDraft(draft({ name: 'A' }), NOW)
    const raw = JSON.parse(storage.getItem(DRAFT_KEY)!)
    storage.setItem(
      DRAFT_KEY,
      JSON.stringify({ ...raw, paid: true, role: 'admin', ownerId: 'someone' }),
    )
    const read = loadDraft(NOW) as unknown as Record<string, unknown>
    expect(read).not.toBeNull()
    expect(read.paid).toBeUndefined()
    expect(read.role).toBeUndefined()
    expect(read.ownerId).toBeUndefined()
  })
})

describe('expiry', () => {
  it('restores a draft up to the TTL', () => {
    saveDraft(draft({ name: 'A' }), NOW)
    const almost = new Date(NOW.getTime() + DRAFT_TTL_DAYS * DAY_MS - 1000)
    expect(loadDraft(almost)).not.toBeNull()
  })

  it('drops one past it, and clears it so the browser stops carrying it', () => {
    saveDraft(draft({ name: 'A' }), NOW)
    const stale = new Date(NOW.getTime() + DRAFT_TTL_DAYS * DAY_MS + 1000)
    expect(loadDraft(stale)).toBeNull()
    expect(storage.getItem(DRAFT_KEY)).toBeNull()
  })

  it('treats an unreadable timestamp as expired rather than as forever', () => {
    expect(draftIsFresh(draft({ updatedAt: 'soon' }), NOW)).toBe(false)
  })
})

describe('clearing', () => {
  it('removes only OurFilm’s key', () => {
    // Never localStorage.clear(): the onboarding shares an origin with the rest
    // of the product, and wiping the store would take everything else with it.
    storage.setItem('unrelated', 'keep me')
    saveDraft(draft({ name: 'A' }), NOW)
    clearDraft()
    expect(storage.getItem(DRAFT_KEY)).toBeNull()
    expect(storage.getItem('unrelated')).toBe('keep me')
  })
})

describe('whether a draft is worth offering back', () => {
  it('says no to an untouched form', () => {
    // Interrupting someone to ask about defaults is a question with no wrong
    // answer, which is the worst kind.
    expect(draftHasAnswers(emptyDraft(NOW, 'Europe/Budapest', KEY))).toBe(false)
  })

  it('says yes once there is a name or any progress', () => {
    expect(draftHasAnswers(draft({ name: 'Az esküvőnk' }))).toBe(true)
    expect(draftHasAnswers(draft({ step: 2 }))).toBe(true)
  })

  it('does not count whitespace as a name', () => {
    expect(draftHasAnswers(draft({ name: '   ' }))).toBe(false)
  })
})
