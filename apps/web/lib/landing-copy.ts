import { SHOT_OPTIONS } from './camera'
import type { Locale } from './i18n'
import type { OccasionId } from './occasions'
import { FREE_PARTICIPANT_LIMIT } from './onboarding'

/**
 * Every string on the homepage, in both languages.
 *
 * Kept apart from `marketing-copy.ts`, which the other marketing pages still
 * read for their navbar and footer: the homepage speaks to any gathering, and
 * those pages have not been rewritten around that yet.
 *
 * Numbers the product enforces are not typed into sentences here. The free
 * guest limit and the roll lengths come from the constants that mirror the
 * database, so the day either changes this page changes with it.
 */

/** The fifth tab. Not an `OccasionId`: it has no page of its own to link to. */
export type LandingOccasionId = OccasionId | 'everyday'

const rolls = (locale: Locale) => {
  const list = [...SHOT_OPTIONS]
  const last = list.pop()
  return `${list.join(', ')} ${locale === 'en' ? 'or' : 'vagy'} ${last}`
}

export const landingCopy = {
  en: {
    nav: {
      aria: 'Main navigation',
      home: 'OurFilm, back to the top',
      howItWorks: 'How it works',
      demo: 'Demo',
      pricing: 'Pricing',
      occasions: 'Occasions',
      allOccasions: 'All occasions',
      blog: 'Blog',
      login: 'Log in',
      create: 'Create for free',
      tryAsGuest: 'Try it as a guest',
      faq: 'Questions',
      explore: 'Explore',
      open: 'Open menu',
      close: 'Close menu',
      /** "For weddings", "For parties" — the menu's own phrasing, by id. */
      occasionItems: {
        wedding: 'For weddings',
        party: 'For parties',
        travel: 'For trips',
        birthday: 'For birthdays',
      } satisfies Record<OccasionId, string>,
    },
    hero: {
      titleLines: ['Your days,', 'through everyone’s eyes.'],
      lead: 'One shared camera for the whole group. Scan the QR code, shoot, and discover your day together. No app and no guest sign-up.',
      create: 'Create for free',
      screenName: 'A weekend together',
    },
    proof: {
      titleLines: ['Want to live it again?', 'Every photo in one place.'],
      stats: [
        ['1', 'SHARED ALBUM'],
        ['0', 'APPS TO DOWNLOAD'],
        [String(FREE_PARTICIPANT_LIMIT), 'GUESTS FREE'],
      ],
      tryAsGuest: 'TRY IT AS A GUEST',
      reviews: [
        {
          title: 'Like living it twice.',
          quote:
            '“We left the QR code beside the guestbook, and people were taking photos before dinner had even started. Opening the gallery the next morning felt like seeing our wedding for a second time.”',
          name: 'Emma & Daniel',
          place: 'Budapest',
        },
        {
          title: 'Everyone got it straight away.',
          quote:
            '“Even the relatives who usually avoid new apps figured it out immediately. They scanned it, entered their name, and were already taking photos.”',
          name: 'Sophie & Adam',
          place: 'Lake Balaton',
        },
        {
          title: 'Just like the night itself.',
          quote:
            '“The no-preview rule changed the mood completely. Nobody stopped to check or retake anything — the photos came out wonderfully spontaneous.”',
          name: 'Lucy & Mark',
          place: 'Etyek',
        },
      ],
    },
    occasions: {
      eyebrow: 'OCCASIONS',
      tabs: {
        wedding: {
          label: 'Wedding',
          title: ['“Moments only', 'your guests saw.”'],
          screenName: 'Anna & Peter',
        },
        birthday: {
          label: 'Birthday',
          title: ['“A birthday, through', 'all your friends’ eyes.”'],
          screenName: 'Lily’s birthday',
        },
        travel: {
          label: 'Trip',
          title: [
            '“You travelled together.',
            'Yet you all saw it differently.”',
          ],
          screenName: 'Our Balaton trip',
        },
        party: {
          label: 'Party',
          title: ['“The night everyone', 'has a photo of.”'],
          screenName: 'Friday night',
        },
        everyday: {
          label: 'Just because',
          title: ['“No big occasion needed.', 'Just be together.”'],
          screenName: 'Just a good day',
        },
      } satisfies Record<
        LandingOccasionId,
        { label: string; title: [string, string]; screenName: string }
      >,
    },
    how: {
      eyebrow: 'HOW IT WORKS',
      title: 'This is how your day becomes a shared film.',
      step: (n: number) => `STEP ${String(n).padStart(2, '0')}`,
      steps: [
        [
          'Create an event',
          'Name your event and choose when the photos become visible.',
        ],
        [
          'Share the QR code',
          'Everyone else scans the code, enters their name and can start shooting.',
        ],
        [
          'Shoot together',
          'Everyone shoots from their own point of view. The memories land in one shared album.',
        ],
      ],
      swipe: 'SWIPE',
      previous: 'Previous step',
      next: 'Next step',
    },
    faq: {
      eyebrow: 'QUESTIONS',
      title: 'Frequently asked questions',
      items: [
        [
          'What is OurFilm for?',
          'OurFilm is a shared digital disposable camera. Guests join with a QR code, and the photos they take from their own point of view land in one private album.',
        ],
        [
          'Do I need to download an app?',
          'No. The camera opens in the phone’s browser, on iPhone and Android alike.',
        ],
        [
          'How do I create an event?',
          'Give your event a name, set when shooting ends and when the photos appear, then share your own QR code.',
        ],
        [
          'Do guests need to sign up?',
          'No. They scan the QR code, enter their name and can start shooting.',
        ],
        [
          'Who can see the photos?',
          'The gallery is private. As the host you see every photo, and you decide whether guests can open it too.',
        ],
        [
          'When do the photos appear?',
          'You choose: right away, or when the event ends. That way you can discover the whole album together.',
        ],
        [
          'Can I download the whole album?',
          'Yes. You can download every photo from the event at once, then share or print them.',
        ],
        [
          'How many photos can a guest take?',
          `You choose ${rolls('en')} shots per guest for each event. No preview and no retakes: every frame is a moment.`,
        ],
        [
          'Can I try it for free?',
          `Yes. OurFilm is free for up to ${FREE_PARTICIPANT_LIMIT} guests. For a bigger group, one payment per event admits unlimited guests — see Pricing.`,
        ],
      ],
      pricingLink: 'Pricing',
    },
    final: {
      titleLines: ['Live it together.', 'Keep it together.'],
      create: 'Create an event',
      screenName: 'A weekend together',
    },
    footer: {
      aria: 'Footer',
      taglineLines: [
        'One shared day. Every point of view.',
        'This is your film.',
      ],
      columns: {
        product: 'OurFilm',
        occasions: 'Occasions',
        help: 'Help',
        about: 'About',
      },
      links: {
        howItWorks: 'How it works',
        guestDemo: 'Guest demo',
        pricing: 'Pricing',
        login: 'Log in',
        faq: 'Questions',
        privacy: 'Privacy',
        terms: 'Terms',
        withdrawal: 'Right of withdrawal',
        about: 'About us',
        blog: 'Blog',
        contact: 'Contact',
        legal: 'Legal notice',
        alternatives: 'Alternatives',
      },
      language: 'Magyar',
      copyright: 'All rights reserved.',
    },
    tryCard: {
      eyebrow: 'TRY IT',
      lines: ['Your camera is waiting.', 'No app to download.'],
      aria: 'Open the guest demo camera',
    },
  },
  hu: {
    nav: {
      aria: 'Fő navigáció',
      home: 'OurFilm, vissza az oldal tetejére',
      howItWorks: 'Így működik',
      demo: 'Demó',
      pricing: 'Árak',
      occasions: 'Alkalmak',
      allOccasions: 'Minden alkalom',
      blog: 'Blog',
      login: 'Belépés',
      create: 'Hozd létre ingyen',
      tryAsGuest: 'Próbáld ki vendégként',
      faq: 'Kérdések',
      explore: 'Fedezd fel',
      open: 'Menü megnyitása',
      close: 'Menü bezárása',
      occasionItems: {
        wedding: 'Esküvőre',
        party: 'Bulira',
        travel: 'Utazáshoz',
        birthday: 'Születésnapra',
      } satisfies Record<OccasionId, string>,
    },
    hero: {
      titleLines: ['A ti napotok,', 'mindenki szemével.'],
      lead: 'Egy közös kamera az egész társaságnak. Olvassátok be a QR-kódot, fotózzatok, és fedezzétek fel együtt a napotokat. App és vendégregisztráció nélkül.',
      create: 'Hozd létre ingyen',
      screenName: 'Egy hétvége együtt',
    },
    proof: {
      titleLines: ['Újra átélnétek?', 'Minden kép egy helyen.'],
      stats: [
        ['1', 'KÖZÖS ALBUM'],
        ['0', 'LETÖLTENDŐ APP'],
        [String(FREE_PARTICIPANT_LIMIT), 'VENDÉGIG INGYEN'],
      ],
      tryAsGuest: 'PRÓBÁLD KI VENDÉGKÉNT',
      reviews: [
        {
          title: 'Mintha kétszer éltük volna át.',
          quote:
            '„A QR-kódot a vendégkönyv mellé tettük, és már vacsora előtt elkezdtek fotózni. Másnap reggel a galéria megnyitása olyan volt, mintha még egyszer átéltük volna az esküvőt.”',
          name: 'Dóri és Bence',
          place: 'Budapest',
        },
        {
          title: 'Mindenki rögtön tudta.',
          quote:
            '„Azok a rokonaink is azonnal boldogultak vele, akik amúgy minden új alkalmazást elkerülnek. Beolvasták, megadták a nevüket, és már fotóztak is.”',
          name: 'Zsófi és Ádám',
          place: 'Balatonfüred',
        },
        {
          title: 'Pont olyan, mint az este.',
          quote:
            '„Az, hogy nem volt előnézet, teljesen más hangulatot adott. Senki nem állt meg visszanézni vagy újrafotózni — a képek gyönyörűen spontánok lettek.”',
          name: 'Luca és Márk',
          place: 'Etyek',
        },
      ],
    },
    occasions: {
      eyebrow: 'ALKALMAK',
      tabs: {
        wedding: {
          label: 'Esküvő',
          title: ['„Pillanatok, amiket csak', 'a vendégeitek láttak.”'],
          screenName: 'Anna & Péter',
        },
        birthday: {
          label: 'Születésnap',
          title: ['„Egy születésnap,', 'az összes barátod szemével.”'],
          screenName: 'Lili születésnapja',
        },
        travel: {
          label: 'Utazás',
          title: ['„Együtt utaztatok.', 'Mégis mást láttatok.”'],
          screenName: 'Együtt a Balatonnál',
        },
        party: {
          label: 'Buli',
          title: ['„Az este, amiről', 'mindenkinek van egy képe.”'],
          screenName: 'Péntek este',
        },
        everyday: {
          label: 'Csak úgy',
          title: ['„Nem kell nagy alkalom.', 'Csak legyetek együtt.”'],
          screenName: 'Csak egy jó nap',
        },
      } satisfies Record<
        LandingOccasionId,
        { label: string; title: [string, string]; screenName: string }
      >,
    },
    how: {
      eyebrow: 'ÍGY MŰKÖDIK',
      title: 'Így lesz a napotokból közös film.',
      step: (n: number) => `${String(n).padStart(2, '0')}. LÉPÉS`,
      steps: [
        [
          'Hozz létre egy eseményt',
          'Adj nevet az eseménynek, és válaszd ki, mikor váljanak láthatóvá a képek.',
        ],
        [
          'Oszd meg a QR-kódot',
          'A többiek beolvassák a kódot, megadják a nevüket, és már fotózhatnak is.',
        ],
        [
          'Fotózzatok együtt',
          'Mindenki a saját szemszögéből fotóz. Az emlékek egy közös albumba kerülnek.',
        ],
      ],
      swipe: 'LAPOZZ',
      previous: 'Előző lépés',
      next: 'Következő lépés',
    },
    faq: {
      eyebrow: 'KÉRDÉSEK',
      title: 'Gyakori kérdések',
      items: [
        [
          'Mire jó az OurFilm?',
          'Az OurFilm egy közös digitális eldobható kamera. A vendégek egy QR-kóddal csatlakoznak, és a saját szemszögükből készített képeik egy privát albumba kerülnek.',
        ],
        [
          'Kell alkalmazást letölteni?',
          'Nem. A kamera a telefon böngészőjében nyílik meg, iPhone-on és Androidon is.',
        ],
        [
          'Hogyan hozhatok létre egy eseményt?',
          'Add meg az esemény nevét, állítsd be, meddig tart a fotózás és mikor jelenjenek meg a képek, majd oszd meg a saját QR-kódodat.',
        ],
        [
          'A vendégeknek kell regisztrálniuk?',
          'Nem. Beolvassák a QR-kódot, megadják a nevüket, és már fotózhatnak is.',
        ],
        [
          'Ki láthatja az elkészült képeket?',
          'A galéria privát. Házigazdaként minden képet látsz, és te döntöd el, hogy a vendégek is megnyithatják-e.',
        ],
        [
          'Mikor jelennek meg a fotók?',
          'Te választod ki: a képek megjelenhetnek azonnal vagy az esemény végén. Így akár együtt is felfedezhetitek az egész albumot.',
        ],
        [
          'Letölthető a teljes album?',
          'Igen. Az esemény összes képét egyben is letöltheted, majd megoszthatod vagy kinyomtathatod őket.',
        ],
        [
          'Hány képet készíthet egy vendég?',
          `Eseményenként ${rolls('hu')} képet engedélyezhetsz vendégenként. Nincs előnézet és újrafotózás: minden képkocka egy pillanat.`,
        ],
        [
          'Ingyen is kipróbálhatom?',
          `Igen. Az OurFilmet ${FREE_PARTICIPANT_LIMIT} vendégig ingyen használhatod. Nagyobb társasághoz egyetlen eseményenkénti díjjal korlátlan vendéget engedhetsz be — részletek az Árak oldalon.`,
        ],
      ],
      pricingLink: 'Árak',
    },
    final: {
      titleLines: ['Együtt megélni.', 'Együtt megőrizni.'],
      create: 'Esemény létrehozása',
      screenName: 'Egy hétvége együtt',
    },
    footer: {
      aria: 'Lábléc',
      taglineLines: ['Egy közös nap. Minden szemszög.', 'Ez a ti filmetek.'],
      columns: {
        product: 'OurFilm',
        occasions: 'Alkalmak',
        help: 'Segítség',
        about: 'Rólunk',
      },
      links: {
        howItWorks: 'Így működik',
        guestDemo: 'Vendégdemó',
        pricing: 'Árak',
        login: 'Belépés',
        faq: 'Kérdések',
        privacy: 'Adatvédelem',
        terms: 'ÁSZF',
        withdrawal: 'Elállás a szerződéstől',
        about: 'Rólunk',
        blog: 'Blog',
        contact: 'Kapcsolat',
        legal: 'Impresszum',
        alternatives: 'Alternatívák',
      },
      language: 'English',
      copyright: 'Minden jog fenntartva.',
    },
    tryCard: {
      eyebrow: 'PRÓBÁLD KI',
      lines: ['A kamerád már vár.', 'Nem kell appot letöltened.'],
      aria: 'A vendégdemó kamera megnyitása',
    },
  },
} satisfies Record<Locale, object>

export type LandingCopy = (typeof landingCopy)[Locale]
