import { z } from 'zod'

import { DEFAULT_SHOTS, REVEAL_CHOICES, SHOT_OPTIONS } from '@/lib/camera'
import { defaultLocale, locales } from '@/lib/i18n'

/**
 * The unfinished event in this browser.
 *
 * The whole create flow can now be filled in signed out, so the answers have to
 * survive an auth round trip that leaves the page — a magic link is read in a
 * mail client and comes back as a fresh navigation. `localStorage` is the only
 * store that survives that without a row for a visitor who has not agreed to
 * anything yet, which is the trade the whole feature is built on: no anonymous
 * events in the database, no lost answers in the browser.
 *
 * **Everything here is untrusted input.** It is a JSON blob any visitor can
 * edit in devtools, so the server re-validates every field at creation and this
 * schema is only what stops a corrupt draft from crashing the form. In
 * particular `plan` is a *wish*, never an entitlement: `full` here buys nothing
 * — only a paid `purchases` row does.
 */

/** Versioned, so a shape change is a fresh start rather than a crash. Bump the
 *  suffix whenever a field changes meaning; the old key is then simply never
 *  read again, and the legacy list below clears it on the next load. */
export const DRAFT_KEY = 'ourfilm:event-draft:v3'

/** Keys from earlier shapes, cleared on load so a browser does not carry an
 *  unreadable blob forever. Add the previous key here when bumping. */
const LEGACY_KEYS = ['ourfilm:event-draft:v1', 'ourfilm:event-draft:v2']

/** How long a draft stays resumable. A week covers "I started this on the bus
 *  and finished it at home"; past that, the dates in it are usually wrong
 *  anyway and offering to restore them is a worse answer than a clean form. */
export const DRAFT_TTL_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000

const draftSchema = z.object({
  locale: z.enum(locales),
  name: z.string().max(80),
  /** `YYYY-MM-DDTHH:mm`, or empty while the host is editing the time field. */
  endLocal: z.string().max(20),
  /** The zone the wall clock above was typed in. Stored so a draft resumed on
   *  the same device in a different place still means what it meant. */
  timeZone: z.string().max(64),
  revealMode: z.enum(REVEAL_CHOICES),
  shots: z.union(
    SHOT_OPTIONS.map((n) => z.literal(n)) as unknown as [
      z.ZodLiteral<number>,
      z.ZodLiteral<number>,
      ...z.ZodLiteral<number>[],
    ],
  ),
  plan: z.enum(['free', 'full']),
  guestsCanView: z.boolean(),
  /** Required on the final screen. Persisted so the explicit choice survives
   *  the magic-link round trip together with the rest of the draft. */
  legalAccepted: z.boolean(),
  /** Which screen to reopen on. Clamped by the form, not here — the number of
   *  steps is the form's business. */
  step: z.number().int().min(0).max(10),
  /** Minted once per draft and sent with the create. What makes a repeated
   *  attempt — a double tap, a reloaded callback, a second tab — land on the
   *  same event instead of a second one. */
  creationKey: z.uuid(),
  /** True between pressing the CTA and the event existing. Set before leaving
   *  for auth, which is how the resume route knows the visitor meant to create
   *  something rather than merely having a draft lying around. */
  pendingCreate: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export type EventDraft = z.infer<typeof draftSchema> & {
  revealMode: (typeof REVEAL_CHOICES)[number]
  shots: (typeof SHOT_OPTIONS)[number]
}

/** Takes the key rather than minting one: this runs during render, and
 *  `crypto.randomUUID()` there would give the server's HTML and the client's
 *  hydration two different values. The page mints it once and passes it down. */
export function emptyDraft(
  now: Date,
  timeZone: string,
  creationKey: string,
  locale: (typeof locales)[number] = defaultLocale,
): EventDraft {
  const stamp = now.toISOString()
  return {
    locale,
    name: '',
    endLocal: '',
    timeZone,
    revealMode: 'event_end',
    shots: DEFAULT_SHOTS,
    plan: 'free',
    guestsCanView: true,
    legalAccepted: false,
    step: 0,
    creationKey,
    pendingCreate: false,
    createdAt: stamp,
    updatedAt: stamp,
  }
}

/** Whether a draft is still worth offering back. Takes `now` rather than
 *  reading a clock, like everything in `lib/camera.ts`, so it is testable and
 *  cannot disagree between two callers. */
export function draftIsFresh(draft: EventDraft, now: Date): boolean {
  const updated = new Date(draft.updatedAt).getTime()
  if (!Number.isFinite(updated)) return false
  return now.getTime() - updated < DRAFT_TTL_DAYS * DAY_MS
}

/** Whether there is anything in here a host would mind losing. A draft that is
 *  only the defaults is not worth interrupting someone to ask about. */
export function draftHasAnswers(draft: EventDraft): boolean {
  return draft.name.trim().length > 0 || draft.step > 0
}

/**
 * Reads the draft, returning null for anything that is not one.
 *
 * Every failure mode lands in the same place: no key, unparseable JSON, a shape
 * from an older version, a value someone edited by hand, `localStorage` that
 * throws (Safari private mode, storage disabled). None of them is worth an
 * error screen — the correct behaviour is an empty form, which is what the
 * caller does with a null.
 */
export function loadDraft(now: Date): EventDraft | null {
  let raw: string | null
  try {
    for (const key of LEGACY_KEYS) window.localStorage.removeItem(key)
    raw = window.localStorage.getItem(DRAFT_KEY)
  } catch {
    return null
  }
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    clearDraft()
    return null
  }

  const result = draftSchema.safeParse(parsed)
  if (!result.success) {
    clearDraft()
    return null
  }

  const draft = result.data as EventDraft
  if (!draftIsFresh(draft, now)) {
    clearDraft()
    return null
  }
  return draft
}

export function saveDraft(draft: EventDraft, now: Date): void {
  try {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ ...draft, updatedAt: now.toISOString() }),
    )
  } catch {
    // A full or disabled store is not a reason to break the form. The cost is
    // that this draft will not survive the auth round trip, which the resume
    // route already has copy for.
  }
}

/**
 * Removes **only** OurFilm's draft.
 *
 * Never `localStorage.clear()`. The onboarding runs on the same origin as the
 * rest of the product, and wiping the store would take anything else living
 * there with it — including whatever a future feature puts in it.
 */
export function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_KEY)
    for (const key of LEGACY_KEYS) window.localStorage.removeItem(key)
  } catch {
    // Nothing to do, and nothing depends on it: the server is what decides
    // whether an event exists.
  }
}
