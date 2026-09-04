import type { Locale } from './i18n'

export const marketingCopy = {
  en: {
    nav: {
      aria: 'Main navigation',
      home: 'OurFilm — back to homepage',
      links: ['How it works', 'Occasions', 'Pricing', 'About'],
      login: 'Log in',
      create: 'Create your camera',
      open: 'Open menu',
      close: 'Close menu',
    },
    hero: {
      eyebrow: 'A DIGITAL DISPOSABLE CAMERA FOR WEDDINGS',
      titleStart: 'Your wedding,',
      titleEnd: 'through your guests’ eyes.',
      lead: 'Guests scan the QR code, get their own roll and start shooting. You reveal every photo together when the night is over.',
      create: 'Create your camera',
      how: 'See how it works',
      helper: 'No app. No guest accounts.',
      /** The one word the headline turns on, italicised inside `titleEnd`. */
      emphasis: 'guests’',
      /** The format, in the counting voice. All four are enforced in the
       *  product — see the landing-page promises in `CLAUDE.md`. */
      claims: ['NO APP', 'NO SIGN-UP', 'NO PREVIEW', 'FREE UP TO 5 GUESTS'],
      gallery: 'Shared gallery',
      couple: 'Anna & Peter',
    },
    benefits: {
      title: 'One camera for the whole wedding.',
      lead: 'Your photographer captures the big moments. Your guests catch everything in between.',
    },
    how: {
      title: 'Three steps. Then let them shoot.',
      tap: 'Tap to start shooting',
      steps: [
        [
          'Create your event',
          'Choose the roll length and when the photos should be revealed.',
        ],
        [
          'Share one QR code',
          'Put it on the tables or send the link to your guests.',
        ],
        [
          'Let your guests shoot',
          'They open the camera and use their own roll. No previews. No retakes.',
        ],
      ],
    },
    qr: {
      eyebrow: 'ONE QR CODE',
      title: 'Your camera is ready for guests.',
      lead: 'Place the QR code on tables, by the entrance or at the bar. One scan and they’re in.',
      label: 'Event name',
      placeholder: 'Anna & Peter',
      fallback: 'Your event name',
      link: 'Shareable link:',
      helper: 'Your event comes with its own QR code and link.',
      cardLabel: 'DIGITAL DISPOSABLE CAMERA',
      cardBody: 'Scan the QR code and capture the day as you see it.',
    },
    reveal: {
      eyebrow: 'PHOTO REVEAL',
      title: 'Keep the photos a surprise.',
      lead: 'Reveal the gallery right away or wait until the event ends.',
      opened: 'Gallery open',
      developing: 'Developing',
      waiting: 'Your photos are still developing',
      waitingBody: 'The gallery opens when the event ends.',
      couple: 'Anna & Peter',
    },
    faq: {
      title: 'Frequently asked questions',
      /** The header's count, as `07 QUESTIONS`. New in Phase 6. */
      countLabel: 'QUESTIONS',
      items: [
        [
          'Do guests need to download an app?',
          'No. The camera opens in their phone browser as soon as they scan the QR code.',
        ],
        [
          'Do guests need an account?',
          'No. They only enter their name so everyone gets their own roll.',
        ],
        [
          'How do guests take photos?',
          'They shoot through the OurFilm camera during the event. There are no previews and no retakes.',
        ],
        [
          'How many photos can each guest take?',
          'You choose the roll length: 5, 10, 16, 24 or 36 shots.',
        ],
        [
          'When can we see the photos?',
          'You choose: reveal them right away or when the event ends.',
        ],
        [
          'Who can see the photos?',
          'The gallery is private. As the host, you can see every photo and choose whether guests can open the gallery.',
        ],
        [
          'Can we download the photos?',
          'Yes. You can download the complete album, then share or print your favourites.',
        ],
      ],
    },
    final: {
      titleStart: 'See your wedding',
      titleEnd: 'through your guests’ eyes.',
      lead: 'Create your event, share the QR code and let your guests capture the rest.',
      create: 'Create your camera',
      helper: 'No app. No guest accounts.',
    },
    /**
     * The persistent camera card. The only strings in the marketing site that
     * are not describing a section — it is a thing on the page rather than a
     * part of the page, which is why it has its own block.
     */
    card: {
      eyebrow: 'TRY OURFILM',
      title: 'Your camera is ready.',
      lead: 'Scan it — no app, no sign-up.',
      dismiss: 'Dismiss',
      reopen: 'TRY THE CAMERA',
    },
    footer: {
      tagline: 'One camera for the whole wedding.',
      aria: 'Footer',
      copyright: 'All rights reserved.',
    },
    demo: {
      scan: 'Scan to start shooting.',
      ready: 'Ready',
      scanning: 'Scanning…',
    },
  },
  hu: {
    nav: {
      aria: 'Fő navigáció',
      home: 'OurFilm — vissza a főoldalra',
      links: ['Hogyan működik', 'Alkalmak', 'Árak', 'Rólunk'],
      login: 'Belépés',
      create: 'Hozzátok létre ingyen',
      open: 'Menü megnyitása',
      close: 'Menü bezárása',
    },
    hero: {
      eyebrow: 'DIGITÁLIS ELDOBHATÓ FÉNYKÉPEZŐGÉP ESKÜVŐRE',
      titleStart: 'Az esküvőtök,',
      titleEnd: 'ahogy a vendégeitek látták.',
      lead: 'A vendégek beolvassák a QR-kódot, mind saját tekercset kapnak, és már fotózhatnak is. A képeket később együtt nézitek meg.',
      create: 'Hozzátok létre ingyen',
      how: 'Így működik',
      helper: 'Nincs app. Nincs vendégregisztráció.',
      emphasis: 'vendégeitek',
      claims: [
        'NINCS APP',
        'NINCS REGISZTRÁCIÓ',
        'NINCS ELŐNÉZET',
        '5 VENDÉGIG INGYEN',
      ],
      gallery: 'Közös galéria',
      couple: 'Anna & Péter',
    },
    benefits: {
      title: 'Egy kamera az egész násznépnek.',
      lead: 'A fotós megörökíti a nagy pillanatokat. A vendégeitek pedig mindazt, ami közben történik.',
    },
    how: {
      title: 'Három lépés, és indulhat a fotózás.',
      tap: 'Koppints a fotózáshoz',
      steps: [
        [
          'Hozzátok létre az eseményt',
          'Állítsátok be, hány képet készíthet egy vendég, és mikor jelenjenek meg a képek.',
        ],
        [
          'Osszátok meg a QR-kódot',
          'Tegyétek ki az asztalokra, vagy küldjétek el a linket a vendégeknek.',
        ],
        [
          'A vendégek fotóznak',
          'Megnyitják a kamerát, és végigfotózzák a saját tekercsüket.',
        ],
      ],
    },
    qr: {
      eyebrow: 'EGYETLEN QR-KÓD',
      title: 'A kamera már várja a vendégeket.',
      lead: 'Tegyétek ki az asztalokra, a bejárathoz vagy a bárpulthoz. A vendégek beolvassák, és már fotózhatnak is.',
      label: 'Az esemény neve',
      placeholder: 'Anna & Péter',
      fallback: 'Az esemény neve',
      link: 'Megosztható link:',
      helper: 'A saját eseményetekhez egyedi QR-kódot és linket kaptok.',
      cardLabel: 'DIGITÁLIS ELDOBHATÓ KAMERA',
      cardBody:
        'Olvasd be a QR-kódot, és fotózd le az estét úgy, ahogy te látod.',
    },
    reveal: {
      eyebrow: 'ELŐHÍVÁS',
      title: 'Maradjon meglepetés, mi sikerült.',
      lead: 'Ti döntitek el, mikor nyíljon meg a galéria: azonnal vagy az esemény végén.',
      opened: 'Megnyílt a galéria',
      developing: 'Előhívás alatt',
      waiting: 'A képek még előhívás alatt vannak',
      waitingBody: 'A galéria az esemény végén nyílik meg.',
      couple: 'Anna & Péter',
    },
    faq: {
      title: 'Gyakori kérdések',
      countLabel: 'KÉRDÉS',
      items: [
        [
          'Kell alkalmazást letölteni?',
          'Nem. A QR-kód beolvasása után a kamera közvetlenül a telefonjuk böngészőjében nyílik meg.',
        ],
        [
          'Kell regisztrálni?',
          'A vendégeknek nem. Csak megadják a nevüket, és máris külön tekercset kapnak.',
        ],
        [
          'Hogyan készülnek a képek?',
          'A vendégek az OurFilm kamerájával fotóznak az eseményen. Nincs előnézet, és nem lehet újrafotózni.',
        ],
        [
          'Hány képet készíthet egy vendég?',
          'Ti választjátok ki: 5, 10, 16, 24 vagy 36 képet.',
        ],
        [
          'Mikor láthatók a képek?',
          'Ti döntitek el: azonnal vagy az esemény végén.',
        ],
        [
          'Ki láthatja a képeket?',
          'A galéria privát. Házigazdaként minden képet láttok, és ti döntitek el, hogy a vendégek is megnyithatják-e.',
        ],
        [
          'Letölthetők a képek?',
          'Igen. Az esemény összes képét egyben is letölthetitek, majd megoszthatjátok vagy kinyomtathatjátok őket.',
        ],
      ],
    },
    final: {
      titleStart: 'Nézzétek meg az esküvőt',
      titleEnd: 'a vendégeitek szemével.',
      lead: 'Hozzátok létre az eseményt, osszátok meg a QR-kódot, és a vendégek már fotózhatnak is.',
      create: 'Hozzátok létre ingyen',
      helper: 'Nincs app. Nincs vendégregisztráció.',
    },
    card: {
      eyebrow: 'PRÓBÁLD KI',
      title: 'A kamerád készen áll.',
      lead: 'Olvasd be — app és regisztráció nélkül.',
      dismiss: 'Bezárás',
      reopen: 'PRÓBÁLD KI A KAMERÁT',
    },
    footer: {
      tagline: 'Egy kamera az egész násznépnek.',
      aria: 'Lábléc',
      copyright: 'Minden jog fenntartva.',
    },
    demo: {
      scan: 'Olvasd be, és fotózz velünk.',
      ready: 'Kész',
      scanning: 'Beolvasás…',
    },
  },
} satisfies Record<Locale, object>
