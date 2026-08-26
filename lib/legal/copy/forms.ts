import { formatMoment } from '@/lib/format'
import { legalConfig, legalText, type LegalConfig } from '@/lib/legal/config'

/**
 * Approved Hungarian for everything that is not a document: the two legal
 * forms, the confirmation emails, the guest acknowledgement, the checkout
 * declarations, the camera's shot and reveal labels, and the host's deletion
 * confirmation.
 *
 * Constants rather than JSX literals for the same reason the documents are
 * data: these strings are approved source copy, and a test has to be able to
 * read exactly what the user sees. A label typed a second time inside a
 * component is a label that will drift.
 */

// ---------------------------------------------------------------------------
// Elállás / felmondás
// ---------------------------------------------------------------------------

export const WITHDRAWAL_COPY = {
  title: 'Elállás vagy felmondás',
  intro: [
    'Ezen az oldalon a fogyasztónak minősülő Házigazda közölheti, hogy eláll a szerződéstől, vagy — ha a szolgáltatás teljesítése már megkezdődött — megszünteti azt.',
    'Az elállási jog főszabály szerint a szerződés megkötésétől számított 14 napon belül gyakorolható. Ha kérted a teljesítés megkezdését e határidő lejárta előtt, a megszüntetésig arányosan teljesített szolgáltatás díja levonható. A kérelem elküldése önmagában nem jelent automatikus visszatérítést; a jogosultságot és az összeget megvizsgáljuk.',
  ],
  labels: {
    name: 'Név',
    order: 'A megrendelés vagy a szerződés azonosítója',
    email: 'A megrendeléshez használt e-mail-cím',
    note: 'Megjegyzés',
  },
  submit: 'Elállás a szerződéstől',
  confirmHeading: 'Elállás megerősítése',
  confirmBody:
    'Kérjük, ellenőrizd az adatokat. A megerősítés után a nyilatkozatot azonnal rögzítjük, és a megadott e-mail-címre visszaigazolást küldünk.',
  confirmSubmit: 'Elállás megerősítése',
  successHeading: 'A nyilatkozatot rögzítettük',
  successBody:
    'Az elállási vagy felmondási nyilatkozat beérkezését e-mailben is visszaigazoljuk. A visszatérítésre való jogosultság és az esetleges arányos díj vizsgálatáról külön tájékoztatást kapsz.',
} as const

export const WITHDRAWAL_EMAIL_SUBJECT =
  'Elállási vagy felmondási nyilatkozat visszaigazolása – OurFilm'

/** The approved body, with only the two tokens filled in. */
export function withdrawalEmailBody(
  {
    submittedAtIso,
    orderReference,
  }: { submittedAtIso: string; orderReference: string },
  config: LegalConfig = legalConfig,
): string {
  return [
    'Szia!',
    '',
    `Visszaigazoljuk, hogy ${formatMoment(submittedAtIso)} időpontban megkaptuk az OurFilm-szerződésre vonatkozó elállási vagy felmondási nyilatkozatodat.`,
    '',
    `Megrendelés vagy szerződés azonosítója: ${orderReference}`,
    '',
    'A nyilatkozat beérkezése önmagában nem jelent automatikus visszatérítést. Megvizsgáljuk a szerződés és a teljesítés állapotát, majd külön tájékoztatunk a jogosultságról, az esetleges arányos díjról és a következő lépésekről.',
    '',
    `Kapcsolat: ${legalText(config.provider.email)}`,
    '',
    'OurFilm',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Jogsértő tartalom bejelentése
// ---------------------------------------------------------------------------

export const REPORT_COPY = {
  title: 'Jogsértő tartalom bejelentése',
  intro:
    'Ezen az oldalon bejelentheted, ha egy OurFilm-eseményben található fényképet vagy más tartalmat jogellenesnek tartasz, vagy az sérti a jogaidat. A bejelentés legyen kellően pontos és indokolt ahhoz, hogy a tartalom és az állított jogsértés azonosítható legyen.',
  helper:
    'Kérjük, ne küldj szükségtelenül személyazonosító okmányt vagy különleges személyes adatot. Ha sürgős veszély, gyermek veszélyeztetése vagy közvetlen bűncselekmény gyanúja áll fenn, fordulj a megfelelő hatósághoz is.',
  labels: {
    name: 'Neved',
    email: 'E-mail-címed',
    event: 'Az esemény hivatkozása vagy azonosítója',
    content: 'A kifogásolt fénykép vagy tartalom azonosítása',
    reason: 'Miért tartod jogellenesnek vagy jogsértőnek?',
    basis: 'Mely jogodat vagy mely jogszabályt érinti?',
  },
  goodFaith:
    'Jóhiszeműen kijelentem, hogy a bejelentésben megadott információk pontosak és hiánytalanok.',
  submit: 'Bejelentés elküldése',
  successBody:
    'Megkaptuk a bejelentést. E-mailben visszaigazolást küldünk, és megvizsgáljuk a kifogásolt tartalmat. Szükség esetén további információt kérhetünk.',
} as const

/**
 * The report confirmation.
 *
 * No approved body was supplied for this one, so nothing new is written: the
 * subject mirrors the withdrawal confirmation's shape, and the body is
 * assembled from sentences already approved on the report page itself plus the
 * reference number. Inventing fresh Hungarian legal prose here is exactly what
 * the brief rules out — see the report of missing copy.
 */
export const REPORT_EMAIL_SUBJECT = 'Bejelentés visszaigazolása – OurFilm'

export function reportEmailBody(
  { reference }: { reference: string },
  config: LegalConfig = legalConfig,
): string {
  return [
    'Szia!',
    '',
    REPORT_COPY.successBody,
    '',
    `A bejelentés azonosítója: ${reference}`,
    '',
    `Kapcsolat: ${legalText(config.provider.email)}`,
    '',
    'OurFilm',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Vendég visszaigazolás az első fotó előtt
// ---------------------------------------------------------------------------

export const GUEST_ACK_COPY = {
  heading: 'Mielőtt fotózol',
  body: 'Csak olyan képet készíts és ossz meg, amelynek elkészítésére és megosztására jogosult vagy. A kép a Házigazda által kiválasztott időpontban válik láthatóvá az esemény résztvevői számára.',
  checkbox: 'Elolvastam és elfogadom a Vendégfelhasználási feltételeket.',
  privacy: 'Az adatkezelés részleteit az Adatkezelési tájékoztató tartalmazza.',
  submit: 'Folytatás a kamerához',
} as const

// ---------------------------------------------------------------------------
// Megrendelés
// ---------------------------------------------------------------------------

export const CHECKOUT_COPY = {
  terms: 'Elolvastam és elfogadom az Általános Szerződési Feltételeket.',
  earlyPerformance:
    'Kifejezetten kérem, hogy az OurFilm a 14 napos elállási határidő lejárta előtt kezdje meg a szolgáltatás teljesítését. Tudomásul veszem, hogy elállás vagy felmondás esetén a megszüntetésig arányosan teljesített szolgáltatás díját meg kell fizetnem, és a szolgáltatás maradéktalan teljesítésével elveszítem az elállási jogomat.',
  privacy:
    'A személyes adatok kezeléséről az Adatkezelési tájékoztatóban olvashatsz.',
  paidSubmit: 'Fizetési kötelezettséggel járó megrendelés',
} as const

// ---------------------------------------------------------------------------
// Kamera
// ---------------------------------------------------------------------------

/**
 * The camera's shot counter and reveal line.
 *
 * Hungarian counts with the singular after a number, so `1` is not a plural
 * branch — it is a differently worded sentence, which is why it is spelled out
 * rather than produced by dropping a suffix.
 */
export const CAMERA_COPY = {
  remaining: (n: number) =>
    n === 1 ? 'Még 1 képed maradt' : `Még ${n} képed maradt`,
  emptyHeading: 'Elfogytak a képeid',
  emptyBody: (shotLimit: number) =>
    `A Házigazda ehhez az eseményhez ${shotLimit} képet engedélyezett résztvevőnként.`,
  revealHelper: (revealLabel: string) =>
    `A képek ekkor válnak láthatóvá: ${revealLabel}`,
  closedHeading: 'A fotózás véget ért',
  closedBody: 'Az esemény lezárult, ezért új kép már nem készíthető.',
} as const

// ---------------------------------------------------------------------------
// Esemény törlése
// ---------------------------------------------------------------------------

export const HOST_DELETE_COPY = {
  heading: 'Esemény végleges törlése',
  body: 'Az esemény, a feltöltött képek és a kapcsolódó hozzáférések véglegesen törlődnek az aktív rendszerből. A művelet nem vonható vissza. Töltsd le előtte azokat a képeket, amelyeket meg szeretnél őrizni.',
  confirmLabel: 'A megerősítéshez írd be: TÖRLÉS',
  /** The word the field must contain. Compared case-sensitively. */
  confirmWord: 'TÖRLÉS',
  submit: 'Esemény végleges törlése',
} as const
