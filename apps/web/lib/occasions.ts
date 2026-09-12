import { Cake, GlassWater, Heart, Plane } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Locale } from './i18n'
import { EVENT_PRICE_LABELS } from './pricing'

/**
 * The one definition of an occasion.
 *
 * Read by four places that must not drift: the homepage wall of prints
 * (`components/site/occasion-prints.tsx`), the `/alkalmak` routes, the footer,
 * and `app/sitemap.ts`. Adding an occasion here gives it a page and a sitemap
 * entry with no other edit.
 *
 * The print's caption and the occasion page's own hero deliberately share
 * `label` and `title` — they say the same thing, so a visitor who taps through
 * lands on the sentence they just tapped rather than a paraphrase of it.
 *
 * Not `server-only` on purpose. It was the homepage's tab carousel that forced
 * that — a Client Component importing this directly — and the carousel is
 * gone; the navbar and footer now hold the constraint, because both are client
 * components and both read `OCCASIONS_ARE_DRAFT`. Icons therefore still have
 * to be component references rather than props, which is fine as long as
 * nothing tries to pass an Occasion across the server/client boundary. The
 * prints section is a Server Component and hands `Reveal` only strings.
 */
export interface Occasion {
  /** URL segment and the widget's state id. */
  slug: string
  label: string
  icon: LucideIcon
  image: string
  /**
   * Where the occasion page's wide header crops this photograph, as a
   * Tailwind `object-position` class. Omitted means centred.
   *
   * One `image` feeds two boxes that want opposite things: the homepage print
   * is 4:5 and portrait, the page header is a wide landscape band. A portrait
   * source is ideal in the first and brutal in the second — `wedding-dance`
   * is 670x1024, so a centred landscape crop of it lands on the couple's
   * waists and takes both their heads off. This is the per-occasion escape
   * hatch; the prints always crop centred, where it is never needed.
   */
  imagePosition?: string
  /** Describes the photograph, for the widget and the page hero. */
  alt: string
  title: string
  /** One-paragraph summary — the widget caption and the page lead. */
  text: string
  /** What the homepage card's link to this page is called. */
  linkLabel: string
  sections: { heading: string; body: string }[]
  /** Six things this camera does, said in this occasion's own terms. Every
   *  one of them is a live product claim — see CLAUDE.md before editing. */
  features: { heading: string; items: { title: string; text: string }[] }
  /** Questions this occasion actually raises, not the homepage's again. */
  faq: [question: string, answer: string][]
  /** Blog document **ids**, not slugs. Resolved per locale and silently
   *  dropped when a locale has no translation, so the section is simply
   *  absent rather than broken — which is the state of every occasion but
   *  the wedding today. */
  posts?: string[]
  /** The page's closing card. Wording differs per occasion — a wedding is
   *  addressed as a couple, a birthday as one host. */
  cta: { heading: string; body: string; button: string; helper: string }
  /** `<title>` and `<meta name="description">` for the page. */
  meta: { title: string; description: string }
}

export type OccasionCopy = Pick<
  Occasion,
  | 'label'
  | 'alt'
  | 'title'
  | 'text'
  | 'linkLabel'
  | 'sections'
  | 'features'
  | 'faq'
  | 'posts'
  | 'cta'
  | 'meta'
>

/**
 * While true, the occasion pages are not part of the site.
 *
 * Four things read this flag and there is nothing else to edit:
 *
 *   - every `/alkalmak` page carries `noindex`
 *   - `app/sitemap.ts` and `/llms.txt` leave the routes out — a sitemap that
 *     advertises noindex URLs sends crawlers two contradictory instructions
 *   - the navbar and the footer do not link to them
 *   - `components/site/occasion-prints.tsx` draws the homepage prints as
 *     plain figures rather than links
 *
 * The routes still resolve either way. A page nobody links to and nobody
 * indexes is withdrawn from the site without being deleted from it, which is
 * what a section awaiting a rewrite wants: the copy, the images and the
 * routing all stay put and one boolean brings them back.
 *
 * **It is now false**, and what earned that is the rewrite: each occasion has
 * a problem block, six feature cards written in its own terms, its own
 * questions and — where the blog has them — its own reading. Setting it back
 * to true withdraws all four again and costs nothing, so it stays as the
 * lever rather than being deleted.
 *
 * The homepage prints are the one reader that shows rather than hides: naming
 * an occasion is a statement about what the camera is for, and linking one is
 * only honest once the page it points at is part of the site.
 */
export const OCCASIONS_ARE_DRAFT = false

/** The same free-trial line closes every occasion page. */
const OCCASION_CTA_HELPER =
  '5 vendégig ingyenes, bankkártya nélkül. A teljes esemény egyszeri 12 900 Ft.'

export const occasions: Occasion[] = [
  {
    slug: 'eskuvo',
    label: 'Esküvő',
    icon: Heart,
    image: '/images/wedding-dance.webp',
    // The only portrait source of the four. Faces sit about a quarter of the
    // way down, so a centred band misses them entirely.
    imagePosition: 'object-[50%_24%]',
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
    features: {
      heading: 'A nagy napra kitalálva.',
      items: [
        {
          title: 'Egy QR-kód mindenkinek',
          text: 'A vendégek beolvassák, megadják a nevüket, és már fotózhatnak. Nem kell app és nem kell regisztráció.',
        },
        {
          title: 'Ti mondjátok meg, mikor nyílik',
          text: 'A galéria megnyílhat azonnal, vagy csak az esküvő végén. Ha meggondoljátok magatokat, előbb is megnyithatjátok.',
        },
        {
          title: 'Mindenkinek ugyanannyi kép jut',
          text: 'Ti választjátok ki, hány képkockát kap egy vendég: 5, 10, 16, 24 vagy 36.',
        },
        {
          title: 'Nyomtatható felbontásban',
          text: 'A képek nem chat-minőségben érkeznek, és az egész albumot egyben letölthetitek.',
        },
        {
          title: 'Ti látjátok először',
          text: 'Házigazdaként minden képet láttok, és bármelyiket elrejthetitek a vendégek elől.',
        },
        {
          title: 'A fotósotok mellé',
          text: 'A fotós a megtervezett pillanatokat viszi. Az OurFilm azt, ami közben az asztaloknál történik.',
        },
      ],
    },
    faq: [
      [
        'Kell a vendégeknek alkalmazást telepíteniük?',
        'Nem. A QR-kód beolvasása után a kamera a telefonjuk böngészőjében nyílik meg.',
      ],
      [
        'Mi történik, ha egy vendég elhasználja a képkockáit?',
        'Akkor betelt a tekercse, ahogy egy eldobható gépnél is. Előre ti állítjátok be, hány kép jusson egy vendégre.',
      ],
      [
        'Láthatják a vendégek egymás képeit?',
        'Ti döntitek el. A galéria megnyílhat a vendégeknek is, vagy maradhat csak nálatok.',
      ],
      [
        'Mennyibe kerül?',
        `5 vendégig ingyenes. Efölött egyszeri ${EVENT_PRICE_LABELS.hu} az egész esküvőre, korlátlan vendéggel.`,
      ],
    ],
    posts: [
      'wedding-qr-code-guide',
      'qr-code-sign-text',
      'wedding-photo-sharing-checklist',
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
    features: {
      heading: 'A bulira kitalálva.',
      items: [
        {
          title: 'Öt perc alatt kész',
          text: 'Megadod a nevét és azt, hogy mikor ér véget. Kapsz egy QR-kódot, és ennyi a teendő.',
        },
        {
          title: 'Maradjon meglepetés',
          text: 'A galéria megnyílhat csak a buli végén, így másnap együtt nézitek meg, mi sikerült.',
        },
        {
          title: 'Beolvassák, és fotóznak',
          text: 'Nincs app, nincs regisztráció. A vendégek csak a nevüket adják meg.',
        },
        {
          title: 'Mindenki ugyanannyit kap',
          text: 'Te választod ki: 5, 10, 16, 24 vagy 36 képkocka jut egy vendégre.',
        },
        {
          title: 'Nincs előnézet, nincs újrafotózás',
          text: 'Ahogy egy eldobható gépnél: megnyomod a gombot, és később derül ki, mi lett belőle.',
        },
        {
          title: 'Másnap egyben letöltöd',
          text: 'Az egész albumot egyszerre töltheted le, nyomtatható felbontásban.',
        },
      ],
    },
    faq: [
      [
        'Kell hozzá alkalmazás?',
        'Nem. A vendégek a QR-kód beolvasása után a böngészőben fotóznak.',
      ],
      [
        'Mi van, ha valaki későn érkezik?',
        'Bármikor becsatlakozhat, amíg a kamera nyitva van, és ő is ugyanannyi képkockát kap.',
      ],
      [
        'Meddig lehet fotózni?',
        'Addig, ameddig beállítod. A zárás idejét később is módosíthatod.',
      ],
      [
        'Mennyibe kerül?',
        `5 vendégig ingyenes. Efölött egyszeri ${EVENT_PRICE_LABELS.hu}, korlátlan vendéggel.`,
      ],
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
    features: {
      heading: 'Az egész útra.',
      items: [
        {
          title: 'Egy link az egész társaságnak',
          text: 'Elküldöd a linket vagy megmutatod a QR-kódot. Aki csatlakozik, saját tekercset kap.',
        },
        {
          title: 'Több napon át ugyanaz a kamera',
          text: 'A kamera addig marad nyitva, ameddig beállítod — egy hétvégére és két hétre is jó.',
        },
        {
          title: 'Gyenge net sem visz el képet',
          text: 'Ha megszakad a kapcsolat, a kép a telefonon várakozik, és magától feltöltődik, amint van hálózat.',
        },
        {
          title: 'Nem kell letölteni semmit',
          text: 'Külföldön sem kell appot telepíteni vagy fiókot létrehozni.',
        },
        {
          title: 'Mindenki más szemszögből',
          text: 'Ugyanaz az út négy-öt ember tekercsén, a végén egyetlen albumban.',
        },
        {
          title: 'A végén egy album',
          text: 'Az út után az egészet egyben letöltitek, nyomtatható felbontásban.',
        },
      ],
    },
    faq: [
      [
        'Működik külföldi SIM-mel vagy szállodai wifivel?',
        'Igen. A kamera a böngészőben fut, bármilyen internetkapcsolattal.',
      ],
      [
        'Mi történik, ha nincs térerő?',
        'A kép a telefonon várakozik, és magától feltöltődik, amint újra van hálózat.',
      ],
      [
        'Meddig maradhat nyitva a kamera?',
        'Ameddig beállítod. Egy hétvégére és egy kéthetes útra is ugyanúgy jó.',
      ],
      [
        'Mennyibe kerül?',
        `5 résztvevőig ingyenes. Efölött egyszeri ${EVENT_PRICE_LABELS.hu}, korlátlan résztvevővel.`,
      ],
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
    features: {
      heading: 'Az estére kitalálva.',
      items: [
        {
          title: 'Beolvassák, és már fotóznak',
          text: 'Egy QR-kód a pultra vagy az asztalokra. Nincs app, nincs regisztráció.',
        },
        {
          title: 'Korlátozott tekercs',
          text: 'Mindenki ugyanannyi képkockát kap, ezért meg is gondolja, mire használja.',
        },
        {
          title: 'Reggel derül ki, mi sikerült',
          text: 'A galéria megnyílhat csak az este végén, így másnap együtt nézitek végig.',
        },
        {
          title: 'Nincs előnézet',
          text: 'Megnyomod a gombot, és nem tudod, mi lett belőle. Ez a formátum, nem hiba.',
        },
        {
          title: 'Te látod először',
          text: 'Házigazdaként minden képet látsz, és bármelyiket elrejtheted.',
        },
        {
          title: 'Egy album, nem húsz beszélgetés',
          text: 'Minden kép egy helyre kerül, és az egészet egyben letöltöd.',
        },
      ],
    },
    faq: [
      [
        'Kell regisztrálni?',
        'A vendégeknek nem. Csak a nevüket adják meg, hogy látszódjon, ki mit fotózott.',
      ],
      [
        'Mi van, ha valaki olyat fotóz, ami nem való bele?',
        'Házigazdaként bármelyik képet elrejtheted, és véglegesen törölheted is.',
      ],
      [
        'Láthatják a vendégek a képeket?',
        'Te döntöd el. A galéria megnyílhat nekik is, vagy maradhat csak nálad.',
      ],
      [
        'Mennyibe kerül?',
        `5 vendégig ingyenes. Efölött egyszeri ${EVENT_PRICE_LABELS.hu}, korlátlan vendéggel.`,
      ],
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
    features: {
      heading: 'Built for the biggest day.',
      items: [
        {
          title: 'One QR code for everyone',
          text: 'Guests scan it, give a name and start shooting. No app to install and no account to make.',
        },
        {
          title: 'You decide when it opens',
          text: 'The gallery can open straight away or only when the wedding ends. Change your mind and you can open it early.',
        },
        {
          title: 'Everyone gets the same roll',
          text: 'You choose how many frames each guest gets: 5, 10, 16, 24 or 36.',
        },
        {
          title: 'Print-ready resolution',
          text: 'Photos do not arrive at chat quality, and the whole album downloads in one go.',
        },
        {
          title: 'You see them first',
          text: 'As the host you see every photo, and you can hide any of them from your guests.',
        },
        {
          title: 'Alongside your photographer',
          text: 'Your photographer takes the planned moments. OurFilm takes what happens at the tables meanwhile.',
        },
      ],
    },
    faq: [
      [
        'Do guests have to install an app?',
        'No. Once they scan the QR code the camera opens in their phone browser.',
      ],
      [
        'What happens when a guest runs out of frames?',
        'Their roll is finished, exactly as it would be on a disposable camera. You set the number of frames in advance.',
      ],
      [
        'Can guests see each other’s photos?',
        'That is your choice. The gallery can open to guests too, or stay with you alone.',
      ],
      [
        'What does it cost?',
        `Free for up to 5 guests. Above that it is a one-off ${EVENT_PRICE_LABELS.en} for the whole wedding, with unlimited guests.`,
      ],
    ],
    posts: ['wedding-photo-sharing'],
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
    features: {
      heading: 'Made for the party.',
      items: [
        {
          title: 'Ready in five minutes',
          text: 'Give it a name and an end time. You get a QR code, and that is the whole setup.',
        },
        {
          title: 'Keep it a surprise',
          text: 'The gallery can open only when the party ends, so you go through it together the next day.',
        },
        {
          title: 'They scan and shoot',
          text: 'No app, no account. Guests only give a name.',
        },
        {
          title: 'Everyone gets the same roll',
          text: 'You choose it: 5, 10, 16, 24 or 36 frames each.',
        },
        {
          title: 'No preview, no retakes',
          text: 'Like a disposable camera: you press the button and find out later what you got.',
        },
        {
          title: 'Download it all the next day',
          text: 'The whole album comes down in one go, at print-ready resolution.',
        },
      ],
    },
    faq: [
      [
        'Is an app needed?',
        'No. Guests scan the QR code and shoot in the browser.',
      ],
      [
        'What if someone arrives late?',
        'They can join any time while the camera is open, and they get the same number of frames.',
      ],
      [
        'How long can people shoot for?',
        'For as long as you set. You can move the closing time later as well.',
      ],
      [
        'What does it cost?',
        `Free for up to 5 guests. Above that it is a one-off ${EVENT_PRICE_LABELS.en}, with unlimited guests.`,
      ],
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
    features: {
      heading: 'For the whole trip.',
      items: [
        {
          title: 'One link for everyone',
          text: 'Send the link or show the QR code. Everyone who joins gets their own roll.',
        },
        {
          title: 'The same camera for days',
          text: 'It stays open for as long as you set, which works for a weekend and for a fortnight.',
        },
        {
          title: 'A weak signal loses nothing',
          text: 'If the connection drops, the photo waits on the phone and uploads by itself once there is a network again.',
        },
        {
          title: 'Nothing to download',
          text: 'No app to install and no account to make, wherever you are.',
        },
        {
          title: 'Every point of view',
          text: 'The same trip across four or five rolls, ending up in a single album.',
        },
        {
          title: 'One album at the end',
          text: 'After the trip you download the whole thing at once, at print-ready resolution.',
        },
      ],
    },
    faq: [
      [
        'Does it work on a foreign SIM or hotel wifi?',
        'Yes. The camera runs in the browser over any internet connection.',
      ],
      [
        'What happens with no signal?',
        'The photo waits on the phone and uploads by itself once there is a network again.',
      ],
      [
        'How long can the camera stay open?',
        'For as long as you set. A weekend and a two-week trip work the same way.',
      ],
      [
        'What does it cost?',
        `Free for up to 5 people. Above that it is a one-off ${EVENT_PRICE_LABELS.en}, with unlimited people.`,
      ],
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
    features: {
      heading: 'Made for the night.',
      items: [
        {
          title: 'They scan and they are shooting',
          text: 'One QR code on the bar or the tables. No app, no account.',
        },
        {
          title: 'A limited roll',
          text: 'Everyone gets the same number of frames, so everyone thinks about what to spend them on.',
        },
        {
          title: 'You find out in the morning',
          text: 'The gallery can open only once the night is over, so you go through it together the next day.',
        },
        {
          title: 'No preview',
          text: 'You press the button and you do not know what you got. That is the format, not a fault.',
        },
        {
          title: 'You see them first',
          text: 'As the host you see every photo and you can hide any of them.',
        },
        {
          title: 'One album, not twenty chats',
          text: 'Every photo lands in one place, and the whole thing downloads in one go.',
        },
      ],
    },
    faq: [
      [
        'Do people have to sign up?',
        'Guests do not. They only give a name, so it is clear who took what.',
      ],
      [
        'What if someone shoots something that does not belong there?',
        'As the host you can hide any photo, and delete it permanently too.',
      ],
      [
        'Can guests see the photos?',
        'That is your choice. The gallery can open to them, or stay with you alone.',
      ],
      [
        'What does it cost?',
        `Free for up to 5 guests. Above that it is a one-off ${EVENT_PRICE_LABELS.en}, with unlimited guests.`,
      ],
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
