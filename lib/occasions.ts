import { Cake, GlassWater, Heart, Plane } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * The one definition of an occasion.
 *
 * Read by three places that must not drift: the homepage tab widget
 * (`components/site/occasions.tsx`), the `/alkalmak` routes, and
 * `app/sitemap.ts`. Adding an occasion here gives it a page and a sitemap
 * entry with no other edit.
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
  sections: { heading: string; body: string }[]
}

/**
 * While true, every `/alkalmak` page renders a draft banner and `noindex`, and
 * `app/sitemap.ts` leaves the routes out — a sitemap that advertises noindex
 * URLs sends crawlers two contradictory instructions.
 *
 * Flip to false in the change that lands the real copy; nothing else needs
 * editing.
 */
export const OCCASIONS_ARE_DRAFT = true

export const occasions: Occasion[] = [
  {
    slug: 'eskuvo',
    label: 'Esküvő',
    icon: Heart,
    image: '/images/wedding-dance.webp',
    alt: 'Esküvői első tánc',
    title: 'Az egész nap, ahogy a vendégek látták',
    text: 'A fotós képei mellett az ölelések, nevetések és késő esti pillanatok is megmaradnak — úgy, ahogy a vendégeid látták őket.',
    sections: [
      {
        heading: 'Miért pont esküvőre',
        body: 'TODO: a fotós több hetes átfutása, és hogy a vendégek képei már aznap este megvannak. Két-három mondat.',
      },
      {
        heading: 'Hova tedd a QR-kódot',
        body: 'TODO: asztali kártyák, ültetőtábla, köszönőajándék. Konkrét, gyakorlati tippek a helyszínen.',
      },
    ],
  },
  {
    slug: 'szuletesnap',
    label: 'Születésnap',
    icon: Cake,
    image: '/images/birthday.webp',
    alt: 'Születésnapi ünneplés',
    title: 'Minden gyertya és minden meglepetés',
    text: 'A tortától az utolsó ölelésig — a vendégek minden nevetős pillanatot egy helyre gyűjtenek.',
    sections: [
      {
        heading: 'Miért pont születésnapra',
        body: 'TODO: az ünnepelt nem fotózhat a saját buliján — a vendégek viszont igen.',
      },
      {
        heading: 'Hova tedd a QR-kódot',
        body: 'TODO: tortaasztal, bejárat, meghívó. Gyakorlati tippek.',
      },
    ],
  },
  {
    slug: 'utazas',
    label: 'Utazás',
    icon: Plane,
    image: '/images/travel.webp',
    alt: 'Közös utazás',
    title: 'A közös élmény, mindenki nézőpontjából',
    text: 'A csapat összes fotója egy albumban — nem kell többé linkeket és üzeneteket vadászni.',
    sections: [
      {
        heading: 'Miért pont utazásra',
        body: 'TODO: a szétszórt csoportos üzenetek és a tömörített képek problémája.',
      },
      {
        heading: 'Hogyan oszd meg az úton',
        body: 'TODO: link a csoportban indulás előtt, QR a szálláson. Gyakorlati tippek.',
      },
    ],
  },
  {
    slug: 'buli',
    label: 'Buli',
    icon: GlassWater,
    image: '/images/party.webp',
    alt: 'Esti buli',
    title: 'Az éjszaka, ahogy tényleg megtörtént',
    text: 'A vendégek az este folyamán töltik fel a képeket, te pedig másnap az egészet egyben kapod meg.',
    sections: [
      {
        heading: 'Miért pont bulira',
        body: 'TODO: másnap senki nem küldi el a képeit — este viszont mindenki fotózik.',
      },
      {
        heading: 'Hova tedd a QR-kódot',
        body: 'TODO: bárpult, mosdó ajtaja, vetítés. Gyakorlati tippek.',
      },
    ],
  },
]

export function occasionBySlug(slug: string): Occasion | undefined {
  return occasions.find((o) => o.slug === slug)
}
