# Host App in the Landing Look — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every host screen (event page, settings, onboarding, lightbox, login, account, and the empty, error and limit states), plus the guest states the handoff mocks, onto the visual system the marketing redesign already uses on `feat/subpages-redesign`.

**Architecture:** First add the landing look as theme tokens and a small set of shared host primitives: class constants, a toast, a saved indicator, a floating panel and a state notice. Then restyle one screen family per task on top of those primitives. Each behaviour change from the handoff is its own commit inside the task that owns its code. The tests here are pure-logic unit tests, because vitest runs in `node` and there is no Testing Library. Visual fidelity is checked in a browser at 390px.

**Tech Stack:** Next 16 App Router, React 19, Tailwind v4 (`@theme` in `apps/web/app/globals.css`), `@base-ui/react`, `lucide-react`, `motion/react` with tokens in `apps/web/lib/motion.ts`, and vitest (node).

**Spec:** `/Users/laszlobujak/Downloads/design_handoff_host_landing_look/README.md`, `DESIGN v5.md`, and the `.dc.html` mockups in the same folder. Open the mockups in a browser; each option carries an id badge (`5a`, `7d`, …).

## Owner decisions (2026-10-19)

- **Photos per guest:** settings keeps `SHOT_OPTIONS` = 5/10/16/24/36. The mockup's 12/24/36 is **not** built, and there is no migration.
- **Lightbox delete:** the delete toast has **no** "Visszavonás" button. Hide keeps its undo, which only re-toggles the photo.
- **Account deletion:** restyle only. "Fiók törlése" still opens the `mailto:` to support, and gains the event and photo counts in its copy.
- **Guest states (7c, 7g, 7h, 7l, 7m) are built now.** The guest page therefore starts loading the landing fonts.

## Global Constraints

- Ground is `#0d0d0d` (`bg-landing`). Panels are `rgba(255,255,255,.04)` with radius 20–32. Tiles and inputs are `rgba(255,255,255,.06)` with radius 14–20. Sheets are `#1c1c1c` with radius 16–28 and shadow `0 24px 60px -20px rgba(0,0,0,.95)`. There are no hairline rows and no borders on controls.
- Primary is solid `#fff` with `#101010` text and radius 16, **one per screen**. Secondary is `rgba(255,255,255,.06–.1)` with white text.
- Sky `#87c7f2` with `#000` text is used **only** for payment buttons and live or selected state. Warning is `#e8c07a` on `rgba(232,192,122,.1)`. Destructive is `#ff9d9d` on `rgba(255,138,138,.1)`.
- Read text is white at ≥65% opacity, and never below 55%. Contrast is at least 4.5:1.
- Type:
  - Display: Roboto Serif 340, `wdth` 125, -.01em. This is the existing `font-landing-display landing-serif` pair.
  - Interface: Inter 400/500.
  - Figures: Crimson Text italic 600.
  - Kickers: Inter 500, 11–12px, `.24em`, uppercase, **1–3 words**.
  - **No** `font-display`, `font-mono`, Manrope, Martian Mono, Instrument Serif or lilac (`accent`) on host screens.
- Tap targets are at least 44px.
- The free cap always comes from `FREE_PARTICIPANT_LIMIT` (`apps/web/lib/onboarding.ts:58`, equal to 5). Copy never contains a literal limit.
- Motion:
  - Durations and easings come from `apps/web/lib/motion.ts` only.
  - Enter decelerates and exit accelerates, with a 320ms maximum.
  - Animate opacity and transform only, except the reveal sample blur, which is `filter`.
  - Text swaps are not animated, and `useReducedMotion` is honoured.
  - `MOTION-RULES.md` does not exist in the repo, so the `lib/motion.ts` header is the rule.
- Floating panels overlay content with an absolute panel plus a full-screen transparent tap-away layer, and cause **zero layout shift**.
- Both locales get every new string. Host copy follows the existing inline `en ? … : …` pattern in each component. Hungarian suffixes attach directly (`az OurFilm`).
- After every task run `pnpm verify` and `pnpm format`, both from the repo root. Never add `typescript.ignoreBuildErrors`. No task here changes a migration, RPC or policy. If one ends up doing so, run `pnpm test:db` against the **local** stack only.
- Visual check:
  - Use `pnpm dev` with `pnpm seed` (set `SEED_HOST_EMAIL`).
  - Check at 390px wide, at 130% text size, and with a 40-character event name.

## Review Focus

1. **A failed autosave must show the old value.** If an autosave fails or the network drops, the control must revert to the server's value with the 7d toast, and "✓ Mentve" must never flash. → Test `autosave reports failure without a saved flash` in Task 3.
2. **The end time is never optimistic.** CLAUDE.md settles that the capture-end and reveal _dates_ are not optimistic. A past end time (7e) keeps the stored value and names it, and the field never shows an unsaved time as if it were saved. → Test `capture end in the past keeps the stored value` in Task 3.
3. **Old drafts in localStorage still restore.** A v3 draft that carries `shots: 10` and `guestsCanView: false` must restore with those values. A new draft with neither field must default to 24 and visible. → Tests in Task 4.
4. **"Ma éjjel" on a party that ends after midnight.** With the end time at 02:00, "Ma éjjel" must mean the coming night (tomorrow's date), not 02:00 earlier today. → `endQuickPick` tests in Task 4.
5. **The banner rule for capped events.** The quota banner must not appear at 3/5. It shows at exactly 4/5 and at 5/5 or more (a guest who joined before the cap can push the count over). It never shows on a paid, comped or admin event. → `quotaBannerState` tests in Task 2.

---

## File map

| Area                         | Files                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tokens and fonts             | `apps/web/app/globals.css`, `apps/web/app/(product)/layout.tsx`, `apps/web/components/landing/fonts.ts` (read only)                                                                                                                                                                                                                                                |
| Shared host primitives (new) | `apps/web/components/host/ui/classes.ts`, `toast.tsx`, `saved-indicator.tsx`, `floating-panel.tsx`, `state-notice.tsx`, `apps/web/lib/host-ui.ts` (pure helpers)                                                                                                                                                                                                   |
| Restyled primitives          | `apps/web/components/host/sheet.tsx`, `apps/web/components/ui/switch.tsx` (host variant), `apps/web/components/host/month-calendar.tsx`                                                                                                                                                                                                                            |
| Event page                   | `app/(product)/host/events/[slug]/page.tsx`, `components/host/host-camera.tsx`, `qr-sheet.tsx`, `quota-banner.tsx`, `moderation-grid.tsx`                                                                                                                                                                                                                          |
| Settings                     | `app/(product)/host/events/[slug]/settings/page.tsx`, `event-name-card.tsx`, `capture-end-card.tsx`, `event-end-fields.tsx`, `reveal-card.tsx`, `reveal-selector.tsx`, `shots-card.tsx`, `shots-selector.tsx`, `post-event-uploads-card.tsx`, `guests-toggle.tsx`, `billing-card.tsx`, `billing-country-field.tsx`, `paid-terms-acceptance.tsx`, `danger-zone.tsx` |
| Onboarding                   | `app/(product)/host/events/new/*`, `components/host/onboarding/*`, `lib/event-draft.ts`, `lib/onboarding.ts`                                                                                                                                                                                                                                                       |
| Lightbox, login, account     | `components/event/lightbox.tsx`, `components/host/moderation-grid.tsx` (viewer footer), `app/(product)/host/login/*`, `app/(product)/host/account/*`                                                                                                                                                                                                               |
| States                       | `components/host/event-list.tsx`, `moderation-grid.tsx`, `billing-card.tsx`, `components/event/guest-event-view.tsx`, `film-strip.tsx`, `join-form.tsx`                                                                                                                                                                                                            |
| Marketing phones             | `components/site/phone-mock.tsx`                                                                                                                                                                                                                                                                                                                                   |

All paths are under `apps/web/` unless they start with `docs/` or `supabase/`.

---

### Task 1: Foundation — tokens, fonts, shared primitives, style guard

**Files:**

- Modify:
  - `app/globals.css`: add host tokens to `@theme inline` and `:root`.
  - `app/(product)/layout.tsx`: add `landingFontClass` to `<body>` beside `bodyClassName`.
  - `components/host/sheet.tsx`: swap `glass-overlay` for the sheet token, radius 28 on top.
  - `components/ui/switch.tsx`: add `tone="host"`, a white track with a `#0d0d0d` knob when on and `white/14` when off. The default tone stays unchanged for the guest side.
- Create:
  - `components/host/ui/classes.ts`
  - `components/host/ui/toast.tsx`
  - `components/host/ui/saved-indicator.tsx`
  - `components/host/ui/floating-panel.tsx`
  - `components/host/ui/state-notice.tsx`
  - `lib/host-ui.ts`
- Test:
  - `tests/unit/host-ui.test.ts`
  - `tests/unit/host-style-guard.test.ts`

**Interfaces:**

- Produces, as tokens: Tailwind colours `host-panel`, `host-tile`, `host-sheet`, `host-warn`, `host-warn-fill`, `host-danger`, `host-danger-fill`, and the shadow `shadow-host-sheet`. Reuse the existing `landing`, `landing-sky` and `landing-ink`. Add a utility `.host-figure` (`font-landing-quote`, italic, 600).
- Produces from `components/host/ui/classes.ts`. These are string constants, mirroring `components/pages/layout.ts`:
  - `HOST_KICKER` (with an optional leading dot)
  - `HOST_TITLE`: Roboto 36 on the event page; questions use `HOST_QUESTION` at 30
  - `HOST_PANEL`: radius 32
  - `HOST_TILE`: radius 20
  - `HOST_PRIMARY`: white, h-14, rounded-[16px]
  - `HOST_SECONDARY`
  - `HOST_PAY`: sky, with `disabled:opacity-40`
  - `HOST_ICON_BUTTON`: size-11, i.e. 44px
  - `HOST_FIELD`: `host-tile`, h-14, rounded-[16px]
- Produces from `lib/host-ui.ts`, as pure functions:
  - `toastReducer(state: ToastState, action: ToastAction): ToastState`, where `ToastState = { id: number; text: string; action?: { label: string } } | null`. The actions are `show`, `dismiss` and `expire(id)`. An `expire` for a stale id is a no-op.
  - `SAVED_FLASH_MS = 1800`
  - `TOAST_MS = 4000`
- Produces as components:
  - `<HostToastProvider>` and `useHostToast(): { show(text: string, action?: { label: string; onAction: () => void }): void }`. The toast is `aria-live="polite"`, fixed at the bottom above the safe area, on `host-sheet`.
  - `<SavedIndicator visible: boolean locale />`, which renders "✓ Mentve" / "✓ Saved" and fades over `T.settle`.
  - `<FloatingPanel open onClose anchorClassName children>`. It renders `position:absolute` under its relatively positioned parent, plus a `fixed inset-0` transparent button that calls `onClose`. Escape closes it and focus returns to the trigger.
  - `<StateNotice tone: 'neutral' | 'warn' | 'danger' title body actions?: ReactNode figure?: ReactNode />` for every empty, error and limit state.

- [ ] **Step 1: Write the failing tests.**
  - `tests/unit/host-ui.test.ts` gets `toastReducer` cases:
    - `show` replaces the current toast and bumps the id.
    - `expire` with the current id clears it.
    - `expire` with an older id leaves the newer toast in place.
  - `tests/unit/host-style-guard.test.ts` reads every `.tsx` file under `app/(product)/host`, `app/(product)/auth`, `components/host`, plus `components/event/lightbox.tsx`. It asserts that none contains the class tokens `font-display`, `font-mono`, `glass`, `paper`, `text-accent`, `bg-accent`, `border-accent` or `ring-accent`, matched as class-name words outside comments.
  - The guard starts with an exported `PENDING` allowlist holding every currently offending file. It also asserts that each `PENDING` entry still offends, so the list cannot go stale. Every later task removes its files from `PENDING`, and Task 8 asserts the list is empty.
- [ ] **Step 2: Run the tests and confirm they fail.** Run `pnpm test -- host-ui host-style-guard`. Expect `host-ui` to fail because the module is missing. The guard passes, since everything is pending.
- [ ] **Step 3: Implement** the tokens, the font class on the product layout, and the five primitives. Then mount `<HostToastProvider>` in `app/(product)/host/layout.tsx`.
  - Keep `.paper` and `.glass*` in `globals.css`, because marketing and the guest side still use them.
  - Restyle `sheet.tsx` and the host `switch` tone, and remove `sheet.tsx` from `PENDING`.
- [ ] **Step 4: Check the build.** Run `pnpm test -- host-ui host-style-guard`, then `pnpm verify`. Expect PASS. In the build output, check that `/e/[slug]` is still `ƒ` and that the route table is unchanged.
- [ ] **Step 5: Commit** with the message "Add the landing look's tokens and shared primitives to the host app".

### Task 2: Event page (`5a`), quota banner visibility, icon buttons

**Files:**

- Modify:
  - `app/(product)/host/events/[slug]/page.tsx`
  - `components/host/host-camera.tsx`
  - `components/host/qr-sheet.tsx`
  - `components/host/quota-banner.tsx`
  - `components/host/moderation-grid.tsx` (grid panel and tiles only; the viewer footer is in Task 5)
  - `lib/host-ui.ts`
- Test: `tests/unit/host-ui.test.ts`

**Interfaces:**

- Consumes everything Task 1 produces.
- Produces `quotaBannerState({ count, limit, unlimited }: { count: number; limit: number; unlimited: boolean }): 'near' | 'full' | null`. It returns `null` when `unlimited`, `'full'` when `count >= limit`, `'near'` when `count === limit - 1`, and `null` otherwise.

- [ ] **Step 1: Write the failing tests.** `quotaBannerState` returns:
  - limit 5: count 3 gives `null`, 4 gives `'near'`, 5 gives `'full'`, and 6 gives `'full'`
  - `unlimited: true`, count 5 gives `null`
  - limit 1: count 0 gives `'near'`
- [ ] **Step 2: Run the tests and confirm they fail.** Run `pnpm test -- host-ui`. Expect FAIL with `quotaBannerState is not a function`.
- [ ] **Step 3: Implement `quotaBannerState`** in `lib/host-ui.ts`. Render `QuotaBanner` only when it returns non-null. The page currently renders it for every free event (`page.tsx:194`).
  - `near` (7j): a `StateNotice` with `tone="warn"` and the kicker "Vendégek 4/5" (count and limit interpolated). A bar shows the count. The copy explains what the next guest will see. The secondary button reads "Feloldás" and links to `settings#billing`.
  - `full` (7k): the kicker is "Betelt 5/5". The copy says those already in are unaffected. The button is a sky `HOST_PAY` button, "Feloldás korlátlan vendéggel →".
  - Commit this behaviour on its own with the message "Show the quota banner only near or at the free cap".
- [ ] **Step 4: Restyle the page to `5a`.**
  - Top row: the `BackLink` "Eseményeid" on the left; on the right two `HOST_ICON_BUTTON` links, `Eye` for the guest view and `Settings` for settings, each with an `aria-label` in both locales. They replace the two pill links at `page.tsx:111-131`. Commit this on its own: "Replace the event page's pill links with icon buttons".
  - Kicker: the `CapturePill` becomes `HOST_KICKER` with a sky `LiveDot` and "Nyitva · még 6:20". The time comes from `shortTimeRemaining`.
  - The h1 uses `HOST_TITLE`.
  - Figures: three `HOST_TILE`s. Each holds an `Odometer` in `.host-figure` at 38px, with the label as a kicker. The labels are "kép", "vendég" and "kép / fő". Keep the red guest-cap-full treatment, recoloured to `host-danger`.
  - The camera row uses a 56px white `HOST_PRIMARY` "Kamera" button and a 56px `QrSheetButton` tile. The `qr-sheet.tsx` ticket loses `paper`, `font-mono` and `font-display`; the QR stays on a white square because scanners need contrast.
  - The grid sits in a `HOST_PANEL` with the heading "Képek 84" (count as `.host-figure`) and `AlbumDownload` kept on the right. The grid is 3 columns with 12px tile radius; hidden tiles stay dimmed. Delete the unused `ModerationGridSkeleton`, or update it to 3 columns.
  - Remove all six files from `PENDING`.
- [ ] **Step 5: Check at 390px.** Run `pnpm verify`, then check `5a` in the browser at 390px. Test a 40-character name, and seed counts of 0, 4 and 5 guests (edit participants locally). Expect it to match the mockup, with no banner at 3.
- [ ] **Step 6: Commit** the restyle: "Rebuild the host event page in the landing look".

### Task 3: Settings (`5b`), autosave, 7d and 7e

**Files:**

- Modify: every settings file in the file map, plus `lib/host-ui.ts`
- Create: `components/host/settings-save.tsx`
- Test: `tests/unit/host-ui.test.ts`

**Interfaces:**

- Consumes: `useHostToast`, `SavedIndicator`, `FloatingPanel`, the host `Switch` tone, and the existing actions `renameEvent`, `setCaptureEnd`, `setReveal`, `setShotsPerParticipant`, `setPostEventUploads` and `setGuestsCanView` (`app/(product)/host/events/[slug]/actions.ts`). Read each one's return type and treat its error shape, or a throw, as a failure.
- Produces:
  - `autosaveOutcome(result: 'ok' | 'error'): { flashSaved: boolean; revert: boolean; toast: 'retry' | null }`
  - `<SettingsSaveProvider locale>` and `useSettingsSave(): { report(outcome: 'ok' | 'error', retry: () => void): void }`. A provider renders the header `SavedIndicator`, which stays visible for `SAVED_FLASH_MS` after each `ok`. An `error` calls `useHostToast().show('Nem sikerült menteni', { label: 'Újra', onAction: retry })`.

- [ ] **Step 1: Write the failing tests.**
  - `autosave reports failure without a saved flash`: `autosaveOutcome('error')` deep-equals `{ flashSaved: false, revert: true, toast: 'retry' }`.
  - `autosaveOutcome('ok')` deep-equals `{ flashSaved: true, revert: false, toast: null }`.
- [ ] **Step 2: Run the tests and confirm they fail.** Run `pnpm test -- host-ui`. Expect FAIL.
- [ ] **Step 3: Implement autosave and remove every Save button.** Commit it on its own: "Autosave host settings and drop the Save buttons".
  - **Gallery switch, post-event uploads, shots:** these are already optimistic. Wire each to `report`. `useOptimistic` already reverts.
  - **Reveal:** make it a two-row radio. Selected is `rgba(135,199,242,.12)` with a sky dot. It saves on pick and is optimistic, like shots. A choice visible at a glance cannot mislead.
  - **Event name:** saves on blur and on Enter, only when the value changed. It is not optimistic: on error, restore the stored name and report.
  - **Capture end:** it stays **not optimistic** (CLAUDE.md, Optimistic updates).
    - The day button opens `MonthCalendar` in a `FloatingPanel`, not a `Sheet`.
    - Time is the native `<input type="time" step="900">`.
    - It saves when a day is picked or on the time input's `change`.
    - **7e:** when `setCaptureEnd` refuses because the time has passed, outline the field in `host-danger`, keep and show the stored value, and add a line naming it: "Ez az időpont már elmúlt. Válassz későbbi időpontot, a korábbi érték (szept. 4. 02:00) megmaradt." Format the stored value with the event zone helpers in `lib/format.ts`.
  - Add the test `capture end in the past keeps the stored value` for the pure piece: `captureEndDisplay(stored: string, attempted: string, refused: boolean) → { value: string; error: boolean }` in `lib/host-ui.ts`, where a refusal returns `stored`.
- [ ] **Step 4: Restyle to `5b`.**
  - Header: "← Anna & Péter", the title "Beállítások", and `SavedIndicator` on the right.
  - Each section is a `HOST_PANEL` with a 16px/500 sentence-case question and no borders.
  - Order: guest gallery, reveal, shots (5/10/16/24/36 as `HOST_TILE` chips, selected white), capture end, post-event uploads, event name, billing, delete.
  - The event name and post-event uploads rows are not in the mockup. They stay because they are shipped features; give them the same row style.
  - **Billing, collapsed by default:** the row reads "Ingyenes esemény · 4/5 vendég" with a secondary "Feloldás" button. Tapping it (label becomes "Mégsem") reveals:
    - the existing `BillingCountryField` and the price
    - `PaidTermsAcceptance` as a white-tick checkbox
    - the sky `HOST_PAY` "Feloldás fizetéssel →", which stays disabled at 40% until the box is ticked and a country is chosen
  - Billing keeps `startEventCheckout`, the settling, cancelled and unlimited variants, and the "payments not enabled" fallback. It opens expanded when the URL hash is `#billing`, so the quota banner's link lands ready to pay.
  - **Danger zone:** a `host-danger` row. The copy names the photo count. The `Sheet` confirmation keeps Cancel autofocused.
  - Remove all settings files from `PENDING`.
- [ ] **Step 5: Check at 390px.** Run `pnpm verify`. In the browser: toggle each control and see "✓ Mentve" for about 1.8s. Then go offline in devtools, toggle again, and see the control revert with the "Újra" toast. Pick a past end time and see 7e. Open the calendar and confirm the page underneath does not move.
- [ ] **Step 6: Commit** the restyle: "Rebuild host settings in the landing look".

### Task 4: Onboarding (6a–6e) and onboarding defaults

**Files:**

- Modify:
  - `app/(product)/host/events/new/new-event-form.tsx`
  - `step-name.tsx`, `step-end.tsx`, `step-reveal.tsx`, `step-guests.tsx`
  - `components/host/onboarding/*`
  - `lib/event-draft.ts`
  - `lib/onboarding.ts`
  - `CLAUDE.md` (create-flow and after-event-uploads paragraphs)
- Test:
  - `tests/unit/event-draft.test.ts`
  - `tests/unit/onboarding-guests.test.ts`
  - `tests/unit/onboarding.test.ts`

**Interfaces:**

- Consumes: `FloatingPanel`, `HOST_*` classes, `DEFAULT_SHOTS` (`lib/camera.ts:24`).
- Produces:
  - `endQuickPick(kind: 'tonight' | 'tomorrow', time: string /* HH:mm */, now: Date, timeZone: string): string /* YYYY-MM-DDTHH:mm */`
  - `activeQuickPick(endLocal: string, now: Date, timeZone: string): 'tonight' | 'tomorrow' | 'other'`
  - Both live in `lib/onboarding.ts`.
  - **Rule:** "tonight" is the night that starts today in `timeZone`. A time of 12:00 or later lands on today's date; a time before 12:00 lands on tomorrow's. "tomorrow" is that date plus one day.
  - `eventNameSuggestions(firstName)` (existing, `lib/onboarding.ts:27`) returns **three** suggestions per locale: `['Esküvőnk', 'Szülinapi buli', 'Egy felejthetetlen este']` and English equivalents.

- [ ] **Step 1: Write the failing tests.**
  - `event-draft.test.ts`:
    - A draft without `shots` and `guestsCanView` parses with `shots: 24` and `guestsCanView: true`.
    - A v3 draft with `shots: 10, guestsCanView: false` restores both unchanged.
    - A draft with `shots: 7` is still rejected.
  - `onboarding.test.ts`:
    - With `Europe/Budapest` and now = 2026-09-03T15:00 local, `endQuickPick('tonight', '02:00', …)` gives `'2026-09-04T02:00'`, `('tonight', '23:00')` gives `'2026-09-03T23:00'`, and `('tomorrow', '02:00')` gives `'2026-09-05T02:00'`.
    - `activeQuickPick` maps each of those back to its kind, and any other date to `'other'`.
    - `eventNameSuggestions(null)` returns 3 items in each locale.
  - `onboarding-guests.test.ts`:
    - The free plan has `ctaDisabled: false` with `legalAccepted: false`, because the free path accepts by pressing, under a terms line.
    - The full plan has `ctaDisabled: true` until `legalAccepted`.
    - The full plan's CTA text is "Tovább a fizetéshez".
- [ ] **Step 2: Run the tests and confirm they fail.** Run `pnpm test -- event-draft onboarding`. Expect FAIL.
- [ ] **Step 3: Implement the defaults.** Commit on its own: "Stop asking roll length and gallery visibility during onboarding".
  - In `draftSchema`, give `shots` `.default(DEFAULT_SHOTS)` and `guestsCanView` `.default(true)`. The `postEventUploads` default stays false. The key stays `v3`, because old drafts are compatible.
  - Remove the "További beállítások" `<details>` (`ShotsSelector`, the gallery switch, `PostEventUploadsField`) from `step-guests.tsx`.
  - Post-event uploads are no longer offered in onboarding; settings is now the only place to turn them on. This is not in the handoff, but the mockup shows no control for it.
  - Free path: drop the checkbox. Pressing "Létrehozás" sets `legalAccepted: true` on the draft before `createEventFromDraft`, and the line "A létrehozással elfogadod az ÁSZF-et és az adatkezelési tájékoztatót." sits under the button. The server still requires `legalAccepted`.
  - Update the CLAUDE.md lines that describe onboarding asking roll, visibility and post-event uploads.
- [ ] **Step 4: Restyle to the mockups.**
  - Shell: "← n / 4", a kicker, the `HOST_QUESTION` title, a lead line, and a white `HOST_PRIMARY` "Tovább →" pinned to the bottom. Drop the `paper btn-shine` CTA.
  - `6a`: the name field shows a placeholder at 35% white. Three 44px suggestion chips; the selected one is white.
  - `6b`: three chips, "Ma éjjel", "Holnap" and "Másik nap" (active state from `activeQuickPick`).
    - "Másik nap" toggles `MonthCalendar` in a `FloatingPanel`.
    - Two tiles below: "Nap" (formatted date) and "Idő" (native time input, `step="900"`).
    - The date button and quick chips share the same `endLocal`.
  - `6c`: two radio rows styled like `5b`. The `reveal-preview` samples blur at 14px and scale 1.05 when `event_end`, sharp when instant. The transition is `filter`/`transform` at 320ms with `T` tokens. The badge reads "Megnyílik · szept. 4. 02:00" or "Azonnal látható".
  - `6d`: two plan tiles. Free shows the figure `{FREE_PARTICIPANT_LIMIT}`, "Vendégig · ingyenes" and "Egy esemény, nincs díj." Paid shows "∞", "Korlátlan · fizetős" and "Egyszeri díj eseményenként." The selected tile gets a sky ring and fill.
    - A line under the tiles: "24 kép vendégenként. A galéria beállításait később a beállításokban módosíthatod." (24 is interpolated from `DEFAULT_SHOTS`.)
    - Paid adds the `PaidTermsAcceptance` checkbox above a sky `HOST_PAY` CTA, dimmed until ticked. The disabled "Hamarosan" tile stays when payments are off.
    - The mockup's billing-country "Magyarország" row is **not** built here. Main deliberately moved the billing country to after the questions (`1b62ddb`), and the checkout screen confirms it.
  - `6e`, the save screen: Roboto title, Google as secondary, an email `HOST_FIELD`, and a white "Küldjétek a linket →".
  - Remove all onboarding files from `PENDING`.
- [ ] **Step 5: Check at 390px.** Run `pnpm verify`, then walk through the flow signed out at 390px. Check the restore prompt with an old draft from `localStorage` (paste a v3 JSON that still has `shots: 10`). Opening "Másik nap" must cause no layout shift.
- [ ] **Step 6: Commit** the restyle: "Rebuild onboarding in the landing look".

### Task 5: Lightbox (8a/8b), login (8c/8d, 7i), account (8e)

**Files:**

- Modify:
  - `components/event/lightbox.tsx` (styling and slot only; guest usage must still work)
  - `components/host/moderation-grid.tsx`: the viewer footer at `:368-470`
  - `app/(product)/host/login/page.tsx`, `login-form.tsx`, `google-sign-in.tsx`, `auth-legal-notice.tsx`
  - `app/(product)/host/account/page.tsx`, `account-name-form.tsx`, `account-language-select.tsx`
  - `lib/host-ui.ts`
- Test: `tests/unit/host-ui.test.ts`

**Interfaces:**

- Produces:
  - `RESEND_COOLDOWN_S = 60`
  - `resendSecondsLeft(sentAt: number, now: number): number`, which clamps at 0
  - `SIGN_IN_LINK_TTL_MINUTES` in `lib/host-ui.ts`. It must equal `otp_expiry / 60` in `supabase/config.toml` (currently 3600, i.e. **60**). See the open item on production.
  - `getHostAlbumTotals(userId: string): Promise<{ events: number; photos: number }>` in `lib/host-totals.ts`. This is a server-only read through the existing server client under ownership RLS, counting photos with `deleted_at is null`.

- [ ] **Step 1: Write the failing tests.**
  - `resendSecondsLeft(0, 18_000)` is 42, `resendSecondsLeft(0, 61_000)` is 0, and `resendSecondsLeft(0, 0)` is 60.
  - A test reads `supabase/config.toml` and asserts `SIGN_IN_LINK_TTL_MINUTES * 60` equals its `[auth.email] otp_expiry`.
- [ ] **Step 2: Run the tests and confirm they fail.** Run `pnpm test -- host-ui`. Expect FAIL.
- [ ] **Step 3: Lightbox footer.**
  - Use one bar on `host-sheet` with Hide/Show ("Elrejtés"/"Megjelenítés"), Save ("Mentés") and Delete ("Törlés", in `host-danger`), each at least 44px.
  - Hide: dim the photo to 55% and show the "Elrejtve a vendégek elől" label. Toast "Elrejtve a vendégek elől" with "Visszavonás", which re-toggles through `setPhotoHidden`. Showing it again toasts "Újra látható a vendégeknek".
  - Delete swaps the same footer to the inline confirmation:
    - "Törlöd ezt a képet?"
    - "{uploader} képe véglegesen törlődik a galériából. Nem vonható vissza."
    - **Cancel is the white primary and autofocused**; Törlés is a danger button.
    - The toast after deleting says "Kép törölve", with **no undo**.
  - The last photo keeps Delete disabled with the existing explanation, restyled (`8b`).
  - The top row shows uploader and time, and "12 / 84".
- [ ] **Step 4: Login.**
  - `8c`:
    - Title "Belépés" / "Sign in".
    - The sentence "Jelszó nélkül lépsz be. Ha még nincs fiókod, ezzel létrejön."
    - Google as `HOST_SECONDARY`, an "vagy" divider, an email `HOST_FIELD`, and a white "Küldjétek a linket →".
    - The terms line.
  - `8d`:
    - "Nézd meg a postaládád", then the address and "{SIGN_IN_LINK_TTL_MINUTES} percig érvényes", plus the spam hint.
    - "Új link küldése · 0:42", disabled while the countdown runs. It re-calls `sendSignInLink` with the same address.
    - "Másik e-mail-cím" returns to the form with the field prefilled.
  - `7i` (`?error=link`): a `StateNotice` with "Ez a link lejárt" and the TTL and single-use sentence. The email field and "Új link küldése" sit below it. The URL carries no address, so the host types it again. Don't persist the address to show it.
  - `?error=oauth`: the same `StateNotice` with its existing copy.
  - Remove the login files from `PENDING`.
- [ ] **Step 5: Account.** Commit the row removal on its own: "Drop the social and marketing rows from the account page".
  - Remove the Instagram, TikTok, Website and Contact nav block (`account/page.tsx:189-238`).
  - Layout: one `HOST_PANEL` with the e-mail address and the method line "Google-fiókkal vagy e-mail linkkel lépsz be." Then the existing name form and language select, which stay because they are shipped and drive the language of host mail.
  - One "Kapcsolat · hello@ourfilm.app" row (`CONTACT_EMAIL`), then "Kijelentkezés" as `HOST_SECONDARY`.
  - Set apart at the bottom: "Fiók törlése", with "A {events} esemény és az összes {photos} kép törlődik. Előbb töltsd le, amit meg akarsz tartani. Nem vonható vissza." It is still the existing `mailto:` link, styled as danger. Use `getHostAlbumTotals` for the counts.
  - Remove the account files from `PENDING`.
- [ ] **Step 6: Check in the browser.** Run `pnpm verify`. In the browser:
  - Hide/undo works, and delete confirm puts focus on Cancel (Enter does not delete).
  - The last photo is guarded.
  - The resend countdown runs.
  - `?error=link` shows 7i.
- [ ] **Step 7: Commit** the restyle: "Rebuild lightbox, login and account in the landing look".

### Task 6: States — host (7a, 7b, 7f) and guest (7c, 7g, 7h, 7l, 7m)

**Files:**

- Modify:
  - `components/host/event-list.tsx`, `moderation-grid.tsx`, `billing-card.tsx`
  - `app/(product)/host/page.tsx`
  - `components/event/guest-event-view.tsx`, `film-strip.tsx`, `join-form.tsx`
  - `lib/host-ui.ts`
- Test: `tests/unit/host-ui.test.ts`

**Interfaces:**

- Consumes: `StateNotice`, `HOST_*`.
- Produces `paymentNotice(purchase: { status: string } | null, cancelledReturn: boolean): 'failed' | 'cancelled' | null`.
  - It returns `'failed'` when the latest purchase status is `failed`.
  - It returns `'cancelled'` on a `?checkout=cancelled` return with no paid purchase.
  - Otherwise it returns `null`.

- [ ] **Step 1: Write the failing tests** for `paymentNotice`:
  - failed purchase gives `'failed'`
  - no purchase with a cancelled return gives `'cancelled'`
  - paid purchase with a cancelled return gives `null`
  - `null` with no return gives `null`
- [ ] **Step 2: Run the tests and confirm they fail.** Run `pnpm test -- host-ui`. Expect FAIL.
- [ ] **Step 3: Host states.**
  - `7a`, in the `EventList` empty branch: "Még nincs eseményed", then the body, then a white "Esemény létrehozása".
  - `7b`, in `ModerationGrid` with 0 photos: "Még nem érkezett kép", then the body, then a secondary "QR-kód megosztása" that opens the `QrSheet`.
  - `7f`, in the billing card from `paymentNotice`:
    - `failed`: "A fizetés nem ment át. Nem vontunk le pénzt."
    - `cancelled`: "A fizetés nem fejeződött be. Nem vontunk le pénzt."
    - Both have a sky "Másik kártya →", which restarts checkout, and a secondary "Segítség kérése" (`mailto:CONTACT_EMAIL`).
    - The mockup's "A bank elutasította a kártyát" is **not** used. Hosted Checkout doesn't tell us why a payment failed, and copy must not guess.
  - Restyle the rest of `event-list.tsx` only enough to pass the guard: drop `font-mono` and `font-display` for Inter/Roboto. The list layout itself is not designed yet (Open).
- [ ] **Step 4: Guest states.** Wrap these in the landing tokens; the fonts are already on the product layout from Task 1.
  - `7c`: own roll unused. "Még nem készítettél képet", plus "Nincs előnézet és nincs újrafotózás." The counter is "24 /24 kép maradt" in `.host-figure`.
  - `7g`: when offline with queued items (the `film-strip.tsx` offline marker), a warn `StateNotice`: "Nincs kapcsolat · {n} kép vár a feltöltésre", "…maguktól feltöltődnek. Ne zárd be az oldalt."
  - `7l`: `join-form.tsx` on `cap_reached`. "Ez az esemény betelt", with the limit interpolated. Tell them to ask the organiser, then scan again. **No checkout**, per CLAUDE.md.
  - `7m`: roll spent. "Elhasználtad az összes képedet", with the reveal time from `lib/event-copy.ts`. The shutter is disabled and reads "Kamera · nincs több kép".
  - `7h`, camera denied: **not wired.** The guest camera is `<input capture>`, which gets no permission callback, and an empty `change` looks exactly like a cancel (CLAUDE.md: no invented signal). Skip it unless the owner decides otherwise (see Open).
  - Remove the remaining files from `PENDING` that this task owns.
- [ ] **Step 5: Check at 390px.** Run `pnpm verify`. In the browser at 390px:
  - Check a new host account (7a), and a seeded event with its photos removed locally (7b).
  - Check `?checkout=cancelled` (7f).
  - Check the guest page offline in devtools with a queued shot (7g).
  - Check a sixth guest joining a free event (7l).
  - Check a 5-shot roll fully spent (7m).
- [ ] **Step 6: Commit**: "Add the host and guest empty, error and limit states".

### Task 7: Free cap everywhere — remove literal limits

**Files:**

- Modify:
  - `app/[locale]/aszf/page.tsx:68`
  - `app/(product)/e/[slug]/actions.ts:108-109`
  - `components/event/join-form.tsx:329-330` (if Task 6 did not already)
  - `lib/occasions.ts`, on lines 119, 189, 273, 352, 431, 521, 529, 597, 604, 672, 679, 747 and 754, plus shot lists at 246 and 570
  - `app/llms.txt/route.ts:80` (shot list)
  - `components/site/phone-mock.tsx`
- Test: `tests/unit/free-cap-literals.test.ts`

The MDX files in `content/{vs,alternatives,pages,compare}/en` say "five"/"5" correctly and cannot interpolate. Leave them; the test does not scan `content/`. The "7" and "10" in those files are competitors' figures.

- [ ] **Step 1: Write the failing test.** `tests/unit/free-cap-literals.test.ts` scans `.ts` and `.tsx` files under `app`, `components` and `lib` (skipping comments). It asserts there are no matches for the regex `/(\b5\s*(vendég|résztvevő|guests?|people)|up to 5\b|five (guests|participants))/i`. It also asserts that `lib/occasions.ts` and `app/llms.txt/route.ts` don't contain the literal `5, 10, 16, 24`.
- [ ] **Step 2: Run the test and confirm it fails.** Run `pnpm test -- free-cap-literals`. Expect FAIL listing about 18 hits.
- [ ] **Step 3: Interpolate everything.** Use `FREE_PARTICIPANT_LIMIT`, the existing `rolls()`-style join of `SHOT_OPTIONS`, and `EVENT_PRICE_LABEL` for `occasions.ts:119`'s hard-coded "12 900 Ft".
  - `phone-mock.tsx`, against `OurFilm Phone.dc.html`:
    - The host ticket stats become the v5 figures ("84 kép / 4 vendég / 24 kép/fő"), with the guest count kept under the cap.
    - Drop `font-mono` in favour of `.host-figure`.
    - The reveal screen copies the v5 `6c`.
- [ ] **Step 4: Run the checks.** Run `pnpm test -- free-cap-literals`, then `pnpm verify`. Expect PASS.
- [ ] **Step 5: Commit**: "Source every free-cap figure from the plan constant".

### Task 8: Closeout

- [ ] **Step 1: Empty the allowlist.** In `host-style-guard.test.ts`, assert `PENDING` is empty and delete the allowlist mechanism. Run `pnpm test -- host-style-guard` and expect PASS.
- [ ] **Step 2: Run the acceptance pass from the README** on every screen above:
  - 390px, 130% text, and a 40-character name.
  - Tab through each screen: 44px targets and visible focus.
  - Contrast spot-checks for the 55%/65% inks.
  - Uppercase kickers of three words at most.
  - Run `pnpm format` and `pnpm verify`.
- [ ] **Step 3: Update `CLAUDE.md` where this branch changed settled text:**
  - the Optimistic updates section (autosave, reveal now optimistic, the toast exists)
  - the create flow (three questions moved to settings, terms line on the free path)
  - analytics: `onboarding_step_completed` still names four steps, so check that the step names didn't change
- [ ] **Step 4: Commit**: "Close out the host landing-look pass".

---

## Open (not planned — needs design or an owner call)

- **Handoff step 7:** the event list layout, guest join flow, guest gallery, album upsell and the marketing subpages in this look. The README says to ask before inventing layouts. Only the 7a empty state and a guard-level restyle of `event-list.tsx` are in this plan.
- **Sign-in link TTL in production.** The mockup says 15 minutes, while local `supabase/config.toml` says `otp_expiry = 3600`. The copy reads its number from `SIGN_IN_LINK_TTL_MINUTES`, and a test pins that to the config. For it to say 15, the owner sets 900 in both `config.toml` and the production Auth settings in the dashboard. Nobody can check the dashboard value from the repo.
- **7h camera permission:** there is no reliable signal with `<input capture>` (see Task 6). Either accept leaving it unwired, or switch the shutter to `getUserMedia`, which is a product change.
- **Unlock price on the pay button:** the README lists this as open. This plan shows `eventPricingFor` once a country is chosen, as the billing card does today.
