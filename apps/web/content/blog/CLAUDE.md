# Writing an article

Rules for everything under `content/blog/`. Follow them and the build passes,
the article looks like the rest of the site, and the sitemap, RSS and
`/llms.txt` update themselves. Most of this is enforced — `pnpm verify` fails
with the file path and the bad field rather than publishing something wrong —
but the enforced parts are the minority, so read the whole thing.

Article copy is **Hungarian**. This file, filenames, ids and frontmatter keys
stay English.

## Copy-paste template

```mdx
---
id: wedding-photo-sharing
locale: hu
slug: eskuvoi-foto-megosztas
title: 'Esküvői fotómegosztás: hogyan gyűjtsd össze az összes képet'
description: 'Egy mondat arról, mit tanul az olvasó. Ez jelenik meg a Google találatában és a megosztásoknál.'
publishedAt: '2026-08-23'
author: 'OurFilm'
related:
  - qr-code-placement
---

Nyitó bekezdés. Nincs `#` cím — a `<h1>` a `title` mezőből készül.

## Első alcím

Szöveg.
```

Save it as `content/blog/hu/eskuvoi-foto-megosztas.mdx` — **the filename must
equal `slug`**, or the build stops.

## Frontmatter

| Field         | Required | Rules                                                                      |
| ------------- | -------- | -------------------------------------------------------------------------- |
| `id`          | yes      | lowercase-kebab-case. The article _across languages_ — see below.          |
| `locale`      | yes      | `hu` or `en`. Must match the folder the file is in.                        |
| `slug`        | yes      | lowercase-kebab-case, **equal to the filename** without `.mdx`.            |
| `title`       | yes      | No `— OurFilm` suffix; that is appended for you.                           |
| `description` | yes      | One sentence. Used for SEO, sharing and the index card.                    |
| `publishedAt` | yes      | `YYYY-MM-DD`, quoted, and a day that actually exists.                      |
| `updatedAt`   | no       | Same format. Set it when you materially revise a published article.        |
| `author`      | no       | Defaults to `OurFilm` in structured data.                                  |
| `image`       | no       | Site-absolute path (`/blog/foo.jpg`), file in `public/blog/`. 1200×630.    |
| `related`     | no       | A list of **ids**, not slugs. Every one must resolve in the same language. |
| `draft`       | no       | `true` hides it from production. See "Drafts".                             |

Quote every string. YAML reads a bare `Igen:` as a key and an unquoted date as
a timestamp, and a colon in an unquoted title breaks the parse — quoting
sidesteps all of it.

### `id` vs `slug`

`slug` is the address in one language. `id` is the article as an idea, shared
by its translations:

```
id: wedding-photo-sharing
  hu → /hu/blog/eskuvoi-foto-megosztas
  en → /en/blog/wedding-photo-sharing
```

That is why a Hungarian URL reads Hungarian, and why `related` lists ids: a
link written today keeps working when the article is translated and its slug
changes language. **Never** link to a translation by swapping `/hu/` for
`/en/` — the slugs share nothing.

Pick the `id` once, in English, and never change it: it is what `related`
entries and translations point at.

### Title and description lengths

Google truncates around **60 characters** of title and **155** of description.
Neither is enforced — nothing breaks — but a title that gets cut mid-word is a
worse result. The `title` also renders as the on-page `<h1>`, so write it for a
reader first and a search engine second.

## Body

- **Start at `##`.** Never write `#`. The `<h1>` comes from `title`, and a
  second one on the page is a real SEO defect.
- Don't skip levels: `##` then `###`, never `##` then `####`.
- Sentence-case headings, no trailing colon.
- Blank line between every block. Two spaces at the end of a line do _not_
  make a line break here — use a paragraph.
- Keep paragraphs to three or four sentences. This is read on a phone.

### Links

Internal links are **locale-prefixed and written in full**: `/hu/arak`,
`/hu/blog/qr-kod-az-asztalokon`, `/hu#live-demo`. There is no automatic
prefixing inside an article — a bare `/arak` will 308-redirect, which works but
wastes a round trip and looks careless in a `<link>` audit.

`/host/login` is the one internal link with **no** locale prefix — the admin
area sits outside the locale tree.

Any `/`-rooted link is routed through `next/link` automatically; anything else
renders as a plain external anchor with `rel="noopener noreferrer"`. Write both
as ordinary markdown links.

### Tables

GitHub-flavoured markdown tables work. Don't hand-align the pipes — `pnpm
format` does it, and it will rewrite whatever you type anyway.

Tables scroll horizontally inside their own container, so a wide one will not
break the page on a phone. Three columns is still the practical maximum before
it becomes a scroll-to-read.

### Images

```mdx
![Leíró magyar alt szöveg](/blog/valami.jpg)
```

File goes in `public/blog/`. Alt text is Hungarian and describes the image —
never "kép" or an empty string, unless it is purely decorative.

Images render as a plain lazy-loaded `<img>`, deliberately: markdown carries no
dimensions, and `next/image` without them means either a guessed aspect ratio
that crops the photo or a wrapper you have to size by hand. For a hero image
worth optimising, import `next/image` at the top of the MDX and place it
explicitly.

## Components

Available in every article with **no import line**:

```mdx
<Cta href="/hu/arak" label="Árak megnézése">
  Egy mondat arról, miért érdemes odakattintani.
</Cta>

<Faq
  items={[
    { q: 'Kell hozzá alkalmazás?', a: 'Nem. A vendég böngészőből tölt fel.' },
    { q: 'Meddig érhető el az album?', a: 'Az esemény után is megmarad.' },
  ]}
/>

<Comparison
  left="Csoportos chat"
  right="OurFilm"
  rows={[
    { left: 'Tömöríti a képet', right: 'Nyomtatható felbontás' },
    { left: 'Elkeveredik', right: 'Egy helyen, egyben letölthető' },
  ]}
/>
```

Leave a blank line before and after each one, and note the `{...}` braces —
these are JSX props, not markdown.

All three render on the server. If you ever add a component with `'use client'`
to an article, the body stops being in the HTML a crawler receives, which
defeats the point of the whole setup.

## Hungarian copy

The house style, in the order it gets forgotten:

- **Tegezés, always.** "Töltsd fel", "Nézd meg", "Olvasd be". Never _Ön_.
- Fixed vocabulary: **esemény**, **vendég**, **házigazda**, **közös album** /
  **galéria**, **feltöltés**, **QR-kód**. Don't reach for synonyms.
- Suffixed abbreviations take a hyphen: `QR-kódot`, `ZIP-ben`, `ZIP-fájl`.
- The product name takes suffixes directly, and it is vowel-initial: **az**
  OurFilm, OurFilm**mel**, OurFilm**hez**, `az OurFilmbe`.
- Em dash with spaces — like this. Ellipsis is `…`, not three dots.
- Dates in prose: `2026. június 13.` Thousands separated by a space.
- Warm, concrete, short.

**Never promise something the product does not do.** The landing page already
makes claims we have to honour; an article is not the place to add more. Check
"Landing page promises we must honor" in the root `CLAUDE.md` before writing a
capability sentence. In particular: no realtime gallery updates, no app, no
scheduled reveal, no email notifications.

The free tier's photo cap is stated on `/hu/arak` and nowhere else — don't
restate a number that can change.

## Drafts

`draft: true` keeps an article visible at its real URL in `pnpm dev` and out of
production entirely: no index entry, no sitemap URL, no RSS item, not in
anyone's "related" list, and the URL 404s in a build.

Delete the line to publish. There is no other switch.

## What the build refuses

Each of these fails `pnpm verify` with the file path and the field:

- a missing or malformed required field
- `publishedAt` that is not `YYYY-MM-DD`, or a day that does not exist
  (`2026-02-31` is rejected rather than quietly becoming March 3rd)
- `slug` that does not match the filename
- `locale` that does not match the folder
- two articles sharing a `slug`, or sharing an `id` within one language
- a `related` id with no article behind it in the same language

## Before you commit

```bash
pnpm format   # rewrites tables, wraps, and normalises the MDX
pnpm verify   # typecheck + lint + build; this is where frontmatter is validated
```

Then look at the page at 390px — the project's standing rule, and articles are
read on phones almost exclusively.

Nothing else needs touching. The route, the index card, the sitemap entry, the
RSS item, `/llms.txt`, and the "related" links on the articles you pointed at
all follow from the file.
