import { Cake, GlassWater, Heart, Plane } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * The one definition of an occasion.
 *
 * Read by four places that must not drift: the homepage tab widget
 * (`components/site/occasions.tsx`), the `/alkalmak` routes, the footer, and
 * `app/sitemap.ts`. Adding an occasion here gives it a page and a sitemap
 * entry with no other edit.
 *
 * The homepage card and the occasion page's own hero deliberately share
 * `title` and `text` — they say the same thing, so a visitor who taps through
 * lands on the sentence they just tapped rather than a paraphrase of it.
 *
 * Not `server-only` on purpose — the homepage widget is a Client Component and
 * imports this directly. Icons therefore have to be component references
 * rather than props, which is fine as long as nothing tries to pass an
 * Occasion across the server/client boundary.
 */
export interface Occasion {
  /** URL segment and the widget's state id. */
  slug: string
  label: string
  icon: LucideIcon
  image: string
  /** Describes the photograph, for the widget and the page hero. */
  alt: string
  title: string
  /** One-paragraph summary — the widget caption and the page lead. */
  text: string
  /** What the homepage card's link to this page is called. */
  linkLabel: string
  sections: { heading: string; body: string }[]
  /** The page's closing card. Wording differs per occasion — a wedding is
   *  addressed as a couple, a birthday as one host. */
  cta: { heading: string; body: string; button: string; helper: string }
  /** `<title>` and `<meta name="description">` for the page. */
  meta: { title: string; description: string }
}

/**
 * While true, every `/alkalmak` page carries `noindex` and `app/sitemap.ts`
 * leaves the routes out — a sitemap that advertises noindex URLs sends
 * crawlers two contradictory instructions.
 *
 * The copy below is final, so the pages no longer show a draft banner. What
 * this still holds back is indexing: these pages link to /arak, which stays
 * out of search results until `hasRealCompanyDetails` is true. Flip to false
 * when the occasion pages are meant to be found; nothing else needs editing.
 */
export const OCCASIONS_ARE_DRAFT = true

/** The same free-trial line closes every occasion page. */
const OCCASION_CTA_HELPER =
  '5 fotóig ingyen, bankkártya nélkül. A teljes esemény egyszeri 12 900 Ft.'

export const occasions: Occasion[] = [
  {
    slug: 'eskuvo',
    label: 'Esküvő',
    icon: Heart,
    image: '/images/wedding-dance.webp',
    alt: 'Esküvői első tánc',
    title: 'A napotok, ahogy a vendégeitek látták.',
    text: 'A fotós megörökíti a nagy pillanatokat. A vendégeitek pedig mindazt, ami közben történik.',
    linkLabel: 'Album esküvőre',
    sections: [
      {
        heading: 'Mert a fotós nem lehet egyszerre mindenhol.',
        body: 'Az asztaloknál, a készülődés közben és a hajnali bulin is készülnek képek. Az OurFilm egy közös albumba gyűjti őket, hogy hozzátok is eljussanak.',
      },
      {
        heading: 'Legyen ott, ahol a vendégek is vannak',
        body: 'Tegyétek ki a QR-kódot az asztalokra, a bárpulthoz vagy a vendégkönyv mellé. A meghívólinket az esküvői csoportban is megoszthatjátok.',
      },
    ],
    cta: {
      heading: 'Lássátok viszont a napot a vendégeitek szemével.',
      body: 'Hozzátok létre az albumot, és gyűjtsétek össze egy helyre a képeket.',
      button: 'Próbáljátok ki ingyen',
      helper: OCCASION_CTA_HELPER,
    },
    meta: {
      title: 'Esküvői közös fotóalbum – OurFilm',
      description:
        'A napotok, ahogy a vendégeitek látták. Egy QR-kód, és minden vendégfotó egy közös albumba kerül.',
    },
  },
  {
    slug: 'szuletesnap',
    label: 'Születésnap',
    icon: Cake,
    image: '/images/birthday.webp',
    alt: 'Születésnapi ünneplés',
    title: 'Te ünnepelsz. A vendégeid fotóznak.',
    text: 'A képek egy közös albumba kerülnek, miközben te a bulit élvezed.',
    linkLabel: 'Album születésnapra',
    sections: [
      {
        heading: 'Ne másnap kelljen elkérned őket',
        body: 'A vendégeid már a helyszínen feltölthetik a fotóikat. Mire véget ér a buli, a képek egy helyen várnak.',
      },
      {
        heading: 'Tedd oda, ahol mindenki látja',
        body: 'Kerüljön egy QR-kód a bejárathoz, a tortaasztalra vagy az italpulthoz. A meghívólinket a közös üzenetben is elküldheted.',
      },
    ],
    cta: {
      heading: 'Gyűjtsd össze a vendégeid fotóit.',
      body: 'Hozd létre az albumot, és oszd meg a vendégeiddel.',
      button: 'Próbáld ki ingyen',
      helper: OCCASION_CTA_HELPER,
    },
    meta: {
      title: 'Születésnapi közös fotóalbum – OurFilm',
      description:
        'A vendégeid fotói egy közös albumban. QR-kóddal, app és regisztráció nélkül.',
    },
  },
  {
    slug: 'utazas',
    label: 'Utazás',
    icon: Plane,
    image: '/images/travel.webp',
    alt: 'Közös utazás',
    title: 'Egy út. Sok telefon. Egy közös album.',
    text: 'Mindenki hozzáadhatja a saját képeit, így semmi nem marad szétszórva.',
    linkLabel: 'Album utazáshoz',
    sections: [
      {
        heading: 'Mindenkinél más képek készülnek',
        body: 'Az OurFilm egy helyre gyűjti őket, hogy az út végén ne különböző csoportokból és mappákból kelljen összeszedned mindent.',
      },
      {
        heading: 'Oszd meg még indulás előtt',
        body: 'Küldd el a meghívólinket a közös csoportba, így mindenki már az első naptól ugyanabba az albumba tölthet.',
      },
    ],
    cta: {
      heading: 'Gyűjtsétek össze egy helyre az út fotóit.',
      body: 'Hozd létre az albumot, és oszd meg az útitársaiddal.',
      button: 'Próbáld ki ingyen',
      helper: OCCASION_CTA_HELPER,
    },
    meta: {
      title: 'Közös fotóalbum utazáshoz – OurFilm',
      description:
        'Gyűjtsétek össze egy helyre az út minden fotóját. Egy link, egy közös album.',
    },
  },
  {
    slug: 'buli',
    label: 'Buli',
    icon: GlassWater,
    image: '/images/party.webp',
    alt: 'Esti buli',
    title: 'Este mindenki fotózik.',
    text: 'Mire véget ér a buli, a feltöltött képek már egy helyen várnak.',
    linkLabel: 'Album bulira',
    sections: [
      {
        heading: 'Ne másnap kelljen összeszedned őket',
        body: 'A vendégek már a helyszínen feltölthetik a fotóikat. Egy QR-kód, és minden kép ugyanabba az albumba kerül.',
      },
      {
        heading: 'Tedd oda, ahol mindenki megfordul',
        body: 'A bejárat, a bárpult és az asztalok a legjobb helyek. Ha van kijelző, azon is megmutathatod a QR-kódot.',
      },
    ],
    cta: {
      heading: 'A buli képei, egyetlen albumban.',
      body: 'Hozd létre az albumot, és oszd meg a vendégeiddel.',
      button: 'Próbáld ki ingyen',
      helper: OCCASION_CTA_HELPER,
    },
    meta: {
      title: 'Közös fotóalbum bulikhoz – OurFilm',
      description:
        'A vendégek a helyszínen feltöltik a képeiket, te pedig egy közös albumban kapod meg őket.',
    },
  },
]

export function occasionBySlug(slug: string): Occasion | undefined {
  return occasions.find((o) => o.slug === slug)
}
