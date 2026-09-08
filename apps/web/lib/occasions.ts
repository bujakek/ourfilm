import { Cake, GlassWater, Heart, Plane } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Locale } from './i18n'
import { EVENT_PRICE_LABELS } from './pricing'

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

export type OccasionCopy = Pick<
  Occasion,
  'label' | 'alt' | 'title' | 'text' | 'linkLabel' | 'sections' | 'cta' | 'meta'
>

/**
 * While true, the occasion pages are not part of the site.
 *
 * Three things read this flag and there is nothing else to edit:
 *
 *   - every `/alkalmak` page carries `noindex`
 *   - `app/sitemap.ts` and `/llms.txt` leave the routes out — a sitemap that
 *     advertises noindex URLs sends crawlers two contradictory instructions
 *   - the navbar and the footer do not link to them
 *
 * The routes still resolve. A page nobody links to and nobody indexes is
 * withdrawn from the site without being deleted from it, which is what a
 * section awaiting a rewrite wants: the copy, the images and the routing all
 * stay put and one boolean brings them back.
 *
 * `components/site/occasions.tsx` — the homepage carousel — is dormant for
 * the same reason but by a different mechanism: `app/[locale]/page.tsx`
 * simply does not render it, the way it does not render `<Stats />`.
 */
export const OCCASIONS_ARE_DRAFT = true

/** The same free-trial line closes every occasion page. */
const OCCASION_CTA_HELPER =
  '5 vendégig ingyenes, bankkártya nélkül. A teljes esemény egyszeri 12 900 Ft.'

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
      body: 'Hozzátok létre a közös kamerát, és döntsétek el, hány képet készíthessen egy vendég, valamint mikor nyíljon meg a galéria.',
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
      heading: 'Legyen egy közös album az egész születésnapból.',
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
    title: 'Egy út. Sok nézőpont. Egy közös album.',
    text: 'Minden útitárs saját digitális tekercset kap. A képek az út végén egyszerre hívódhatnak elő.',
    linkLabel: 'Közös kamera utazáshoz',
    sections: [
      {
        heading: 'Mindenki mást vesz észre',
        body: 'Ugyanazt az utat mindenki másképp látja. A saját digitális tekercsek képeiből a végén egy közös album áll össze.',
      },
      {
        heading: 'Oszd meg még indulás előtt',
        body: 'Küldd el a meghívólinket a közös csoportba, így mindenki már az első naptól a saját tekercsével fotózhat. Alkalmazást senkinek sem kell letöltenie.',
      },
    ],
    cta: {
      heading: 'Nézzétek vissza együtt az utat.',
      body: 'Hozd létre a közös kamerát, oszd meg az útitársaiddal, és állítsd be, mikor nyíljon meg a galéria.',
      button: 'Próbáld ki ingyen',
      helper: OCCASION_CTA_HELPER,
    },
    meta: {
      title: 'Közös digitális kamera utazáshoz – OurFilm',
      description:
        'Minden útitárs saját digitális tekercset kap, a képek pedig egy közös albumba kerülnek. Alkalmazás és regisztráció nélkül.',
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
      body: 'Hozd létre a közös kamerát, állítsd be a képek számát, és döntsd el, mikor nyíljon meg a galéria.',
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

const englishOccasions: Record<string, OccasionCopy> = {
  eskuvo: {
    label: 'Wedding',
    alt: 'A couple sharing their first dance',
    title: 'Your wedding, through your guests’ eyes.',
    text: 'Your photographer captures the big moments. Your guests catch everything in between.',
    linkLabel: 'Wedding guest camera',
    sections: [
      {
        heading: 'Because your photographer cannot be everywhere.',
        body: 'The tables, the getting-ready room and the late-night dance floor are full of moments only your guests see. OurFilm gives everyone their own roll, so the whole day is captured from every side.',
      },
      {
        heading: 'Put it where your guests will see it.',
        body: 'Place the QR code on the tables, by the bar or next to the guest book. One scan opens the camera — no app and no account needed.',
      },
    ],
    cta: {
      heading: 'See the day through your guests’ eyes.',
      body: 'Create your camera, choose the roll length and decide when the photos should be revealed.',
      button: 'Create your camera',
      helper: `Free for up to 5 guests. No card required. The full event costs ${EVENT_PRICE_LABELS.en} once.`,
    },
    meta: {
      title: 'Wedding Guest Camera – OurFilm',
      description:
        'Give every guest their own digital roll with one QR code. No app, no accounts and no chasing photos after the wedding.',
    },
  },
  szuletesnap: {
    label: 'Birthday',
    alt: 'Friends celebrating a birthday',
    title: 'You celebrate. Your guests capture it.',
    text: 'Everyone gets their own roll, and every photo lands in one private gallery.',
    linkLabel: 'Guest camera for birthdays',
    sections: [
      {
        heading: 'No chasing photos the next morning.',
        body: 'Guests scan the QR code and shoot straight into your shared camera. The photos are already in one place before the party is over.',
      },
      {
        heading: 'Put the QR code in plain sight.',
        body: 'Try the entrance, the cake table or the bar. Guests can open their roll without downloading an app or creating an account.',
      },
    ],
    cta: {
      heading: 'Turn the whole birthday into one shared roll.',
      body: 'Create the event, choose the number of shots and decide when the gallery opens.',
      button: 'Create your camera',
      helper: `Free for up to 5 guests. No card required. The full event costs ${EVENT_PRICE_LABELS.en} once.`,
    },
    meta: {
      title: 'Digital Guest Camera for Birthdays – OurFilm',
      description:
        'Give every guest their own digital roll for your birthday. One QR code, no app and no accounts.',
    },
  },
  utazas: {
    label: 'Trips',
    alt: 'Friends travelling together',
    title: 'One trip. Many viewpoints. One shared roll.',
    text: 'Everyone notices something different. Bring every version of the trip together in one gallery.',
    linkLabel: 'Shared camera for trips',
    sections: [
      {
        heading: 'Everyone sees a different trip.',
        body: 'Give each traveller their own digital roll and bring every viewpoint together when the trip ends.',
      },
      {
        heading: 'Share it before you leave.',
        body: 'Drop the invite link in the group chat so everyone can start shooting from day one. No one needs another app.',
      },
    ],
    cta: {
      heading: 'Relive the trip together.',
      body: 'Create your shared camera, send it to the group and choose when the photos are revealed.',
      button: 'Create your camera',
      helper: `Free for up to 5 guests. No card required. The full event costs ${EVENT_PRICE_LABELS.en} once.`,
    },
    meta: {
      title: 'Shared Digital Camera for Group Trips – OurFilm',
      description:
        'Give every traveller their own digital roll and collect the whole trip in one gallery. No app or accounts needed.',
    },
  },
  buli: {
    label: 'Parties',
    alt: 'Friends at an evening party',
    title: 'Everyone shoots. You get every side of the night.',
    text: 'Give each guest a limited roll, then reveal the whole party together.',
    linkLabel: 'Guest camera for parties',
    sections: [
      {
        heading: 'No photo chase the next day.',
        body: 'The QR code opens the shared camera instantly, so guests shoot into the same album while the party is happening.',
      },
      {
        heading: 'Put it where the party happens.',
        body: 'The entrance, bar and tables all work well. After one scan, every guest gets their own limited roll.',
      },
    ],
    cta: {
      heading: 'See the party from every angle.',
      body: 'Create your camera, choose the roll length and decide when the gallery opens.',
      button: 'Create your camera',
      helper: `Free for up to 5 guests. No card required. The full event costs ${EVENT_PRICE_LABELS.en} once.`,
    },
    meta: {
      title: 'Digital Guest Camera for Parties – OurFilm',
      description:
        'Guests scan one QR code, get their own roll and capture the party together. No app or accounts.',
    },
  },
}

export function occasionCopy(locale: Locale, occasion: Occasion): OccasionCopy {
  return locale === 'en' ? englishOccasions[occasion.slug] : occasion
}
