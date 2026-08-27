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
  '5 fotóig ingyen, bankkártya nélkül. A teljes album egyszeri 12 900 Ft.'

export const occasions: Occasion[] = [
  {
    slug: 'eskuvo',
    label: 'Esküvő',
    icon: Heart,
    image: '/images/wedding-dance.webp',
    alt: 'Esküvői első tánc',
    title: 'A napotok, ahogy a vendégeitek látták.',
    text: 'A fotós megörökíti a nagy pillanatokat. A vendégeitek pedig mindazt, ami közben történik.',
    linkLabel: 'Vendégkamera esküvőre',
    sections: [
      {
        heading: 'Mert a fotós nem lehet egyszerre mindenhol.',
        body: 'Az asztaloknál, a készülődés közben és a hajnali bulin is történnek olyan pillanatok, amelyeket csak a vendégeitek látnak. Az OurFilmmel mindenki saját digitális tekercset kap, és a saját szemszögéből fotózhatja végig a napot.',
      },
      {
        heading: 'Legyen ott, ahol a vendégek is vannak',
        body: 'Tegyétek ki a QR-kódot az asztalokra, a bárpulthoz vagy a vendégkönyv mellé. A vendégek beolvasás után rögtön fotózhatnak, alkalmazás és regisztráció nélkül.',
      },
    ],
    cta: {
      heading: 'Lássátok viszont a napot a vendégeitek szemével.',
      body: 'Hozzátok létre a közös filmet, és döntsétek el, hány képkockát kapjanak a vendégek, valamint mikor hívódjanak elő a képek.',
      button: 'Próbáljátok ki ingyen',
      helper: OCCASION_CTA_HELPER,
    },
    meta: {
      title: 'Esküvői vendégkamera – OurFilm',
      description:
        'A vendégek QR-kóddal nyitják meg saját digitális tekercsüket. Nincs app, nincs regisztráció, a képek pedig akkor jelennek meg, amikor szeretnétek.',
    },
  },
  {
    slug: 'szuletesnap',
    label: 'Születésnap',
    icon: Cake,
    image: '/images/birthday.webp',
    alt: 'Születésnapi ünneplés',
    title: 'Te ünnepelsz. A vendégeid fotóznak.',
    text: 'Minden vendég saját digitális tekercset kap. A képek pedig akkor jelennek meg, amikor te szeretnéd.',
    linkLabel: 'Vendégkamera születésnapra',
    sections: [
      {
        heading: 'Ne másnap kelljen elkérned a képeket.',
        body: 'A vendégeid a QR-kód után rögtön fotózhatnak a közös kamerával. Nem kell utólag képeket kérned vagy üzenetekből összeszedned őket.',
      },
      {
        heading: 'Tedd oda, ahol mindenki látja',
        body: 'Kerüljön egy QR-kód a bejárathoz, a tortaasztalra vagy az italpulthoz. A vendégek alkalmazás és regisztráció nélkül nyithatják meg a saját tekercsüket.',
      },
    ],
    cta: {
      heading: 'Legyen egy közös film az egész születésnapból.',
      body: 'Hozd létre az eseményt, állítsd be a képkockák számát és válaszd ki, mikor jelenjenek meg a fotók.',
      button: 'Próbáld ki ingyen',
      helper: OCCASION_CTA_HELPER,
    },
    meta: {
      title: 'Születésnapi vendégkamera – OurFilm',
      description:
        'Adj minden vendégnek saját digitális tekercset a születésnapra. QR-kóddal, alkalmazás és regisztráció nélkül.',
    },
  },
  {
    slug: 'utazas',
    label: 'Utazás',
    icon: Plane,
    image: '/images/travel.webp',
    alt: 'Közös utazás',
    title: 'Egy út. Sok nézőpont. Egy közös film.',
    text: 'Minden útitárs saját digitális tekercset kap. A képek az út végén egyszerre hívódhatnak elő.',
    linkLabel: 'Közös kamera utazáshoz',
    sections: [
      {
        heading: 'Mindenki mást vesz észre',
        body: 'Ugyanazt az utat mindenki másképp látja. A saját digitális tekercsekből a végén egy közös film áll össze.',
      },
      {
        heading: 'Oszd meg még indulás előtt',
        body: 'Küldd el a meghívólinket a közös csoportba, így mindenki már az első naptól a saját tekercsével fotózhat. Alkalmazást senkinek sem kell letöltenie.',
      },
    ],
    cta: {
      heading: 'Nézzétek vissza együtt az utat.',
      body: 'Hozd létre a közös filmet, oszd meg az útitársaiddal, és állítsd be, mikor hívódjanak elő a képek.',
      button: 'Próbáld ki ingyen',
      helper: OCCASION_CTA_HELPER,
    },
    meta: {
      title: 'Közös digitális kamera utazáshoz – OurFilm',
      description:
        'Minden útitárs saját digitális tekercset kap, a képekből pedig egy közös film áll össze. Alkalmazás és regisztráció nélkül.',
    },
  },
  {
    slug: 'buli',
    label: 'Buli',
    icon: GlassWater,
    image: '/images/party.webp',
    alt: 'Esti buli',
    title: 'Este mindenki fotózik.',
    text: 'Minden vendég saját digitális tekercset kap. A képek az este végén egyszerre jelenhetnek meg.',
    linkLabel: 'Vendégkamera bulira',
    sections: [
      {
        heading: 'Ne másnap kelljen összeszedned a képeket.',
        body: 'A QR-kód rögtön megnyitja a közös kamerát, így a vendégek a buli közben fotózhatnak. Nincs utólagos képbekérés és nincs letöltendő alkalmazás.',
      },
      {
        heading: 'Tedd oda, ahol mindenki megfordul',
        body: 'A bejárat, a bárpult és az asztalok a legjobb helyek. Egy beolvasás után minden vendég megkapja a saját, véges számú képkockáját.',
      },
    ],
    cta: {
      heading: 'Lássátok viszont a bulit minden szemszögből.',
      body: 'Hozd létre a közös filmet, állítsd be a képkockák számát, és döntsd el, mikor jelenjenek meg a fotók.',
      button: 'Próbáld ki ingyen',
      helper: OCCASION_CTA_HELPER,
    },
    meta: {
      title: 'Digitális vendégkamera bulikhoz – OurFilm',
      description:
        'A vendégek QR-kóddal nyitják meg saját digitális tekercsüket, és a buli közben fotóznak. Alkalmazás és regisztráció nélkül.',
    },
  },
]

export function occasionBySlug(slug: string): Occasion | undefined {
  return occasions.find((o) => o.slug === slug)
}
