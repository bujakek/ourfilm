---
name: ourfilm-ui
description: OurFilm's landing look and Hungarian UI copy conventions. Covers the tokens in app/globals.css, the three faces, the class-string modules for the host app, the public site and the homepage, the one-white-button rule, colour meanings, motion tokens, mobile-first sizing, and accessibility patterns. Use when building or restyling any OurFilm page or component — guest event pages, the host app, onboarding, marketing pages, emails — or when writing Hungarian user-facing copy.
---

# OurFilm UI

One look everywhere, called **the landing look**: white washes on a near-black
ground, a wide display serif, Inter for everything read, Crimson italic for
figures, and one white button per screen. The host app, the guest pages, the
public site and the emails all wear it. The source design is the v5 handoff
(`DESIGN v5.md`); this is the working summary.

Tailwind CSS v4 with **CSS-based config** — all tokens live in
`apps/web/app/globals.css` under `@theme`. There is no `tailwind.config.js`;
never create one.

## Non-negotiables

- **The old look is gone, and a test keeps it gone.** No lilac, no `.glass`, no
  `.paper`, no `btn-shine`, no Instrument Serif (`font-display`), no Martian
  Mono (`font-mono`). `apps/web/tests/unit/style-guard.test.ts` fails on any of
  them anywhere in `app/` or `components/`.
- **Never introduce a new colour.** Use the tokens below. If a design needs one
  that isn't there, add a CSS variable in `globals.css` and a token for it.
- **One primary per screen.** Solid white, `#101010` text, radius 16. Everything
  else is secondary: a white wash, no border.
- **No borders on controls** in the product. Panels and tiles are fills.
- **Read text is at least 55% white.** Kickers and body copy sit at 65%.
- **Dark only.** There is no light mode.
- **Mobile-first.** Guests arrive on phones. Design at 390px first.
- **Both locales for every string** a person reads.
- Run `pnpm format` after editing — Prettier sorts Tailwind classes.

## Tokens

| Token                                 | Value           | Use                                                                        |
| ------------------------------------- | --------------- | -------------------------------------------------------------------------- |
| `bg-landing`                          | `#0d0d0d`       | The ground, product and public site alike                                  |
| `bg-host-panel`                       | white 4%        | A grouping panel, radius 20–32                                             |
| `bg-host-tile`                        | white 6%        | A tile, field or secondary control inside a panel                          |
| `bg-host-sheet` / `shadow-host-sheet` | `#1c1c1c`       | Sheets and floating panels                                                 |
| `text-white`, `text-white/65`         |                 | Headings; body copy and kickers                                            |
| `text-landing-ink`                    | `#101010`       | Text on the white button                                                   |
| `landing-sky`                         | `#87c7f2`       | **Only** payment, and what is live or selected                             |
| `host-warn` / `host-warn-fill`        | `#e8c07a`       | Offline, a hold, a caveat                                                  |
| `host-danger` / `host-danger-fill`    | `#ff9d9d`       | A refusal, a failure, a destructive action                                 |
| `site-*`                              | greys and lines | The public site's quieter inks (`site-muted`, `site-line`, `site-surface`) |

## Faces

Loaded by `components/landing/fonts.ts`. The product root layout and
`SiteShell` already apply them, and the product body is Inter.

- **Display:** `font-landing-display landing-serif` — Roboto Serif at width
  125, weight 340. Event names, page and section headings, onboarding
  questions.
- **UI:** `font-landing-sans` — Inter. Everything a person reads or types.
- **Figures:** `host-figure` — Crimson Text italic 600. Counts, frame counters,
  step numbers.
- **Kicker:** Inter 500, 11–12px, tracked capitals, one to three words. Never a
  sentence.

## Use the class modules, not new strings

- **Host app and guest pages:** `components/host/ui/classes.ts` —
  `HOST_KICKER`, `HOST_TITLE`, `HOST_QUESTION`, `HOST_PANEL`, `HOST_TILE`,
  `HOST_PRIMARY`, `HOST_SECONDARY`, `HOST_PAY` (sky, payment only),
  `HOST_ICON_BUTTON`, `HOST_FIELD`, `HOST_ROW_QUESTION`, `HOST_ROW_DETAIL`,
  `HOST_LINK`, `HOST_FOCUS`. Every button and link class there carries the
  white focus mark and the `T.settle` transition.
- **Public pages:** `components/pages/layout.ts` — `SITE_CONTAINER`,
  `SITE_KICKER`, `SITE_HEADING`, `SITE_LEAD`, `SITE_BUTTON`. Wrap the page in
  `SiteShell` (`components/pages/site-shell.tsx`); a standalone page with a
  header uses `PageShell`.
- **Homepage sections:** `components/landing/layout.ts`.
- **Shared host pieces** in `components/host/ui/`: `StateNotice` for empty,
  error and limit states, `useHostToast` for confirmations, `SavedIndicator`.
- **Dates and times** use the phone's own pickers (`EventEndFields`): a native
  `type="time"`, and a native `type="date"` laid invisibly over a tile that
  draws the date, because a visible one overflows on iOS.
- **Articles:** MDX bodies render through `proseComponents` inside a
  `.site-prose` wrapper; `<Cta>`, `<Faq>` and `<Comparison>` need no import.

```tsx
<section className={`${HOST_PANEL} px-6 py-8`}>
  <p className={HOST_KICKER}>{en ? 'Your roll' : 'A tekercsed'}</p>
  <p className="host-figure mt-1 text-[44px] leading-[0.9] text-white">24</p>
  <button type="button" className={`mt-6 w-full ${HOST_PRIMARY}`}>
    {en ? 'Open camera' : 'Kamera megnyitása'}
  </button>
</section>
```

Lucide icons use `size-*`, not `w-`/`h-`.

## Motion

- Only the tokens in `apps/web/lib/motion.ts`: `T.settle` (280ms), `T.exit`
  (160ms), `T.advance` (340ms), `T.snap` for a finger's spring. Nothing
  slower than about 320ms on a control; animate opacity and transform only.
- CSS cannot import `lib/motion.ts`, so a CSS transition writes the token's
  values out with a comment naming it (see `SETTLE` in `classes.ts`).
- Honour reduced motion: `useReducedMotion()` and the `still` transition. The
  global `prefers-reduced-motion` rule in `globals.css` covers CSS.
- A floating panel or toast causes zero layout shift.

## Accessibility

- `:focus-visible` is a white outline globally; never remove outlines.
- Tap targets ≥ 44px — thumbs, one-handed, in the dark.
- Decorative layers get `aria-hidden="true"` and `pointer-events-none`.
- Custom controls need real semantics: switches use `role="switch"` and
  `aria-checked`, accordions `aria-expanded` and `aria-controls`.
- Every `<input>` has a real `<label>`. A status that changes is announced
  through one always-mounted `aria-live` region, not one that mounts with its
  text.

## Hungarian copy

All user-facing text exists in English and Hungarian; code and comments stay
English.

**Identifiers are English, always** — section ids and anchors, routes, storage
keys, state values, CSS class names. Only what a person reads is translated.
An anchor like `#zaro-cta` ends up in the address bar, which is not the place
for it.

- **Address the reader informally** (tegezés): "Töltsd fel", "Nézd meg", "Olvasd be". Never formal _Ön_.
- Vocabulary is fixed — reuse it: **esemény** (event), **vendég** (guest), **házigazda** (host), **közös album / galéria**, **feltöltés** (upload), **QR-kód**.
- **az** OurFilm, OurFilm**mel**.
- Hyphenate suffixed abbreviations the Hungarian way: `QR-kódot`, `ZIP-ben`, `ZIP-fájl`.
- Dates: `2026. június 13.` Numbers: space thousands separator.
- Use the em dash with spaces — like this — and `…` for ellipsis (`Feltöltés…`).
- Tone: warm, concrete, short. Promise only what's built. Before adding a capability claim, check the "Landing page promises" section of `CLAUDE.md`.
- The free cap is always `FREE_PARTICIPANT_LIMIT`, never a literal.

## Guest-facing event screen

These are not marketing pages — tighten the rhythm:

- One column, the shutter and the share tile together near the event facts.
  The shutter is the screen's one white button; sharing is a tile beside it.
  Do not put the native camera on a separate page or recreate a live
  `getUserMedia` view.
- The live state is sky, offline is amber, a failure is `host-danger`.
- Photo grids reserve their space from the stored `width`/`height` so nothing
  shifts.
- No scroll-driven entrances: guests are here to act, not to read a pitch.
