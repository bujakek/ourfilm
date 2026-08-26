---
name: ourfilm-ui
description: OurFilm's dark glassmorphism design system and Hungarian UI copy conventions. Covers the glass/glass-strong surface utilities, design tokens in app/globals.css, the standard section scaffold, the Reveal scroll animation, mobile-first sizing, and accessibility patterns. Use when building or restyling any OurFilm page or component — event pages, upload, gallery, admin, or marketing sections — or when writing Hungarian user-facing copy.
---

# OurFilm UI

Dark glassmorphism on near-black. Tailwind CSS v4 with **CSS-based config** — all tokens live in `app/globals.css` under `@theme`. There is no `tailwind.config.js`; never create one.

## Non-negotiables

- **Never introduce a new color.** Use the tokens below. If a design needs a color that isn't there, add it as a CSS variable in `app/globals.css` and reference it via a token.
- **Never use raw hex in components.** `text-accent`, not `text-[#c3b6ff]`. (Decorative glow blobs in `background-glow.tsx` are the one existing exception.)
- **Dark only.** `color-scheme: dark` is set globally; there is no light mode and no theme toggle.
- **Mobile-first.** Guests arrive on phones. Design at 390px, then add `sm:` / `lg:`.
- Run `pnpm format` after editing — Prettier sorts Tailwind classes, so don't hand-order them.

## Tokens

| Token                                | Value                    | Use                                          |
| ------------------------------------ | ------------------------ | -------------------------------------------- |
| `bg-background`                      | `#050505`                | Page background                              |
| `bg-background-secondary`            | `#0b0b0d`                | Inset panels behind glass                    |
| `text-foreground`                    | `#f7f7f7`                | Primary text                                 |
| `text-muted-foreground`              | `#a1a1aa`                | Body copy, captions, labels                  |
| `text-accent`                        | `#c3b6ff`                | Lilac accent — eyebrows, icons, active state |
| `accent-blue` / `accent-silver`      | `#9db4ff` / `#d8dae5`    | Gradient partners only                       |
| `border` / `border-strong`           | white 8% / 16%           | Glass edges; `border-strong` on hover        |
| `bg-primary text-primary-foreground` | near-white on near-black | Primary buttons (inverted)                   |

Radii are large and soft: `rounded-2xl` (1rem) for controls, `rounded-3xl` for cards, `rounded-[2rem]` for hero-scale containers. Font is Manrope via `font-sans` (already on `<body>`).

## Surface utilities

Defined in `app/globals.css` — compose them with Tailwind:

- `.glass` — standard liquid-glass surface (blur 20px, white 6%→2% gradient, inset highlight). Default for cards, inputs, pills, badges.
- `.glass-strong` — heavier blur and brighter edge. For the one hero element on a screen, or a container wrapping other glass.
- `.glass-nav` — the fixed nav pill. Two states: a bright translucent film at rest, plus `.glass-nav-scrolled` (toggled from the component's scroll state) which condenses it to a near-solid pill so links stay readable over content. Blur is deliberately low — tint carries the contrast. Pair it with padding/gap/text-size that shrink on the same 0.22s transition; the pill is meant to visibly condense, not just change color.
- `.glass-hover` — lift + lilac glow on hover. Add to interactive cards only, always alongside `.glass`.
- `.text-gradient` (silver) / `.text-gradient-accent` (lilac→blue) — headline emphasis. One per screen at most.
- `.btn-shine` — sheen sweep on hover. Primary CTAs only.
- `.grain` — noise overlay via `::before`; needs a `relative` parent.

```tsx
<article className="glass glass-hover flex h-full flex-col rounded-3xl p-7">
  <span className="glass flex size-12 items-center justify-center rounded-2xl">
    <Icon className="size-6 text-accent" strokeWidth={1.6} />
  </span>
  <h3 className="mt-6 text-lg font-semibold">{title}</h3>
  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
</article>
```

Lucide icons use `size-*` (not `w-`/`h-`) and `strokeWidth={1.6}` on display icons.

## Section scaffold

Every full-width section follows this rhythm. Copy it:

```tsx
<section className="relative px-4 py-24 sm:px-6 lg:py-32">
  <div className="mx-auto max-w-6xl">
    <Reveal className="max-w-2xl">
      <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
        EYEBROW
      </span>
      <h2 className="mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        Headline
      </h2>
      <p className="mt-4 text-pretty text-muted-foreground">Supporting copy.</p>
    </Reveal>
    {/* content, usually <Reveal delay={100}> */}
  </div>
</section>
```

- Container: `max-w-6xl` for grids, `max-w-3xl` for text-only (FAQ).
- Headings always get `tracking-tight` and `text-balance`; body copy gets `text-pretty`.
- Uppercase eyebrow pill is the section marker — keep it short.

## Motion

- **`<Reveal>`** (`components/site/reveal.tsx`) — IntersectionObserver fade-up, fires once. Stagger grids with `delay={i * 90}`. Accepts `as` for semantic tags (`article`, `li`, `header`).
- Ambient animations: `animate-float-slow`, `animate-float-slower`, `animate-glow-drift`. Offset duplicates with `[animation-delay:-6s]`.
- Transitions use the `cubic-bezier(0.16, 1, 0.3, 1)` ease already baked into the glass utilities. Hover lifts are `-translate-y-*` or `scale-[1.02]` — subtle only.
- `prefers-reduced-motion` is handled globally in `globals.css`. Don't add per-component guards.

## Accessibility

The landing page holds a real standard — match it:

- `:focus-visible` styling is global; never remove outlines.
- Decorative layers get `aria-hidden="true"` + `pointer-events-none` (see `background-glow.tsx`).
- Custom controls need real semantics: toggles use `aria-pressed`, accordions use `aria-expanded` + `aria-controls` with a `role="region"` panel, drag interactions ship a parallel `<input type="range">` with `aria-label` (see `photo-quality.tsx`).
- Every `<input>` needs a real `<label>`. Every `next/image` needs a meaningful Hungarian `alt`.
- Tap targets ≥ 44px on guest-facing screens — thumbs, one-handed, in the dark.

## Hungarian copy

All user-facing text is Hungarian; code and comments stay English.

**Identifiers are English, always** — section ids and anchors, routes, storage
keys, state values, CSS class names. Only what a person reads is Hungarian. An
anchor like `#zaro-cta` ends up in the address bar, which is not the place for
it; the nav label above it stays `Vélemények` while the target is
`#testimonials`.

- **Address the reader informally** (tegezés): "Töltsd fel", "Nézd meg", "Olvasd be". Never formal _Ön_.
- Vocabulary is fixed — reuse it: **esemény** (event), **vendég** (guest), **házigazda** (host), **közös album / galéria**, **feltöltés** (upload), **QR-kód**.
- Hyphenate suffixed abbreviations the Hungarian way: `QR-kódot`, `ZIP-ben`, `ZIP-fájl`.
- Dates: `2026. június 13.` Numbers: space thousands separator.
- Use the em dash with spaces — like this — and `…` for ellipsis (`Feltöltés…`).
- Tone: warm, concrete, short. Promise only what's built. Before adding a capability claim, check the "Landing page promises" section of `CLAUDE.md`.

## Guest-facing event screen

These are not marketing pages — tighten the rhythm:

- Vertical padding drops to `py-10 sm:py-16`; sections stack in a single column.
- Keep sharing and the primary camera action together near the event facts. The
  camera is the larger, inverted button; sharing is secondary. Do not put the
  native camera on a separate page or recreate a live `getUserMedia` view.
- Photo grids: `grid-cols-2 sm:grid-cols-3` with `gap-2`, `aspect-square`, `rounded-2xl`, `object-cover`. Reserve space with the stored `width`/`height` to avoid layout shift.
- Keep `<BackgroundGlow />` for continuity with the landing page, but skip heavy `Reveal` staggering — guests are here to act, not to scroll a pitch.
