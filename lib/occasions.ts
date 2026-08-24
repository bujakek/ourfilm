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

export const occasions: Occasion[] = [
  {
    slug: 'eskuvo',
    label: 'Esküvő',
    icon: Heart,
    image: '/images/wedding-dance.webp',
    alt: 'Esküvői első tánc',
    title: 'Az egész nap, ahogy a vendégek látták',
    text: 'A fotós megörökíti a nagy pillanatokat. Az OurFilm összegyűjti mindazt, ami közben a vendégeid telefonjára került — egy közös albumban, app nélkül.',
    sections: [
      {
        heading: 'A fotós nem lehet egyszerre mindenhol. A vendégeid igen.',
        body: 'Az OurFilm nem a fotós helyett van, hanem mellette. Amíg ő a szertartást és a portrékat fotózza, a vendégeid az asztaloknál, a készülődés közben és a késő esti bulin fotóznak. Ezek a képek általában a telefonjukon vagy egy-egy Messenger-beszélgetésben maradnak, és sosem jutnak el hozzád. Az OurFilmmel a feltöltött fotók már az esemény alatt a közös albumba kerülnek, ahonnan egyben letöltöd őket.',
      },
      {
        heading: 'Hova tedd a QR-kódot',
        body: 'A legjobb, ha több helyen is elérhető, nem csak egyetlen, könnyen elkerülhető ponton. Tegyél kártyát az asztalokra, a bárpulthoz és a vendégkönyv mellé, a meghívólinket pedig küldd el az esküvői Messenger-csoportba. A ceremóniamester egyszer, röviden be is mondhatja: egy mondat elég ahhoz, hogy mindenki tudja, hova kerülnek a képek.',
      },
    ],
  },
  {
    slug: 'szuletesnap',
    label: 'Születésnap',
    icon: Cake,
    image: '/images/birthday.webp',
    alt: 'Születésnapi ünneplés',
    title: 'A saját bulidról marad a legkevesebb fotód',
    text: 'Az ünnepelt egész este mindenkivel beszélget, nem fotózik. A vendégek viszont igen, és az ő képeik egy közös albumba kerülnek.',
    sections: [
      {
        heading: 'Miért pont születésnapra',
        body: 'Ha te vagy az ünnepelt, végig mással vagy elfoglalva: köszöntesz, tortát vágsz, beszélgetsz. A vendégeid közben végig fotóznak. Az OurFilmmel nem kell másnap egyesével elkérned a képeiket, mert amit feltöltenek, az már ott van egy helyen.',
      },
      {
        heading: 'Hova tedd a QR-kódot',
        body: 'Egy kártya a bejárathoz, egy a tortaasztalra, egy az italpulthoz: ezen a három helyen mindenki megfordul az este folyamán. Ha digitális meghívót vagy csoportos üzenetet küldtél, tedd bele a meghívólinket is, így azok is fel tudnak tölteni, akik korán hazamennek.',
      },
    ],
  },
  {
    slug: 'utazas',
    label: 'Utazás',
    icon: Plane,
    image: '/images/travel.webp',
    alt: 'Közös utazás',
    title: 'Az út végén mindenkinél más képek maradnak',
    text: 'Egy közös albumba gyűjtöd a fotókat, ahelyett hogy csoportokban és megosztási linkekben szóródnának szét.',
    sections: [
      {
        heading: 'Miért pont utazásra',
        body: 'Egy közös úton mindenki mást fotóz, és a végén mindenkinél más képek maradnak. Ami átmegy az üzenetküldőkön, az gyakran összenyomva érkezik meg, a többi pedig különböző csoportokban és megosztási linkeken szóródik szét. Az OurFilmbe feltöltött képek egy helyre kerülnek, nagy felbontásban, és a hazaérkezés után egyben letölthetők.',
      },
      {
        heading: 'Hogyan oszd meg az úton',
        body: 'Itt a meghívólink fontosabb, mint a nyomtatott QR-kód: küldd el a közös csoportba még indulás előtt, így már az első naptól mindenki tud tölteni. A QR-kódot elég egyszer megmutatnod a telefonodról, ha valaki útközben csatlakozik a csapathoz.',
      },
    ],
  },
  {
    slug: 'buli',
    label: 'Buli',
    icon: GlassWater,
    image: '/images/party.webp',
    alt: 'Esti buli',
    title: 'Este mindenki fotózik, másnap már nehéz összeszedni',
    text: 'A képek akkor kerülnek a közös albumba, amikor még mindenki a helyszínen van. Nem kell másnap összeszedned őket.',
    sections: [
      {
        heading: 'Miért pont bulira',
        body: 'Az este folyamán mindenki fotózik, másnap viszont már sokkal kisebb az esélye, hogy a képek el is jutnak hozzád. Az OurFilmmel a vendégek ott helyben, két koppintással feltöltenek, így nem marad minden az ő telefonjukon.',
      },
      {
        heading: 'Hova tedd a QR-kódot',
        body: 'A bejárat, a bárpult és az asztalok a legbiztosabb helyek. Ha van vetítés vagy kijelző, tedd ki rá a kódot két számblokk között, és egy kártya a mosdóhoz vezető folyosón is meglepően jól működik. Minél több ponton látszik, annál kevesebb kép marad a telefonokon.',
      },
    ],
  },
]

export function occasionBySlug(slug: string): Occasion | undefined {
  return occasions.find((o) => o.slug === slug)
}
