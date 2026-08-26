/**
 * The approved Hungarian, checked against what the product actually does.
 *
 *     pnpm test
 *
 * Two jobs, and the second is the reason this file is long.
 *
 * The first is hygiene: no unresolved `{{TOKEN}}`, no placeholder identifiers,
 * no link to the EU online dispute resolution platform (withdrawn), no legacy
 * claim the pivot falsified.
 *
 * The second is that four passages of this copy are **chosen by the
 * implementation** — which frame spends a shot, whether a guest may retake,
 * where the camera image goes, what happens to EXIF. Each is asserted against
 * the constant in `lib/legal/facts.ts` that records the evidence, so changing
 * the capture pipeline without revisiting the legal pages fails here rather
 * than quietly publishing a false statement.
 */
import { describe, expect, it } from 'vitest'

import { documentStrings, type LegalDocument } from '@/lib/legal/document'
import { LEGAL_EFFECTIVE_LABEL, legalConfig } from '@/lib/legal/config'
import {
  CAMERA_COPY,
  CHECKOUT_COPY,
  GUEST_ACK_COPY,
  HOST_DELETE_COPY,
  REPORT_COPY,
  reportEmailBody,
  WITHDRAWAL_COPY,
  WITHDRAWAL_EMAIL_SUBJECT,
  withdrawalEmailBody,
} from '@/lib/legal/copy/forms'
import { processingAnnexDocument } from '@/lib/legal/copy/adatfeldolgozasi-melleklet'
import { privacyDocument } from '@/lib/legal/copy/adatvedelem'
import { termsDocument } from '@/lib/legal/copy/aszf'
import { imprintDocument } from '@/lib/legal/copy/impresszum'
import { guestTermsDocument } from '@/lib/legal/copy/vendegfeltetelek'
import { retentionEmailBody } from '@/lib/legal/copy/retention'
import {
  CAMERA_STREAM,
  IMAGE_METADATA,
  RETAKE_SUPPORT,
  SHOT_CONSUMPTION,
} from '@/lib/legal/facts'

const documents: [string, LegalDocument][] = [
  ['impresszum', imprintDocument()],
  ['aszf', termsDocument()],
  ['adatvedelem', privacyDocument()],
  ['vendegfeltetelek', guestTermsDocument()],
  ['adatfeldolgozasi-melleklet', processingAnnexDocument()],
]

/** Every string a visitor can read, across every document and both forms. */
const everything = [
  ...documents.flatMap(([, doc]) => documentStrings(doc)),
  ...Object.values(WITHDRAWAL_COPY).flatMap((v) =>
    typeof v === 'string' ? [v] : Object.values(v),
  ),
  ...Object.values(REPORT_COPY).flatMap((v) =>
    typeof v === 'string' ? [v] : Object.values(v),
  ),
  ...Object.values(GUEST_ACK_COPY),
  ...Object.values(CHECKOUT_COPY),
  ...Object.values(HOST_DELETE_COPY),
  WITHDRAWAL_EMAIL_SUBJECT,
  withdrawalEmailBody({
    submittedAtIso: '2026-08-26T10:00:00.000Z',
    orderReference: 'ORD-1',
  }),
  reportEmailBody({ reference: 'BEJ-ABCDE-FGHIJ' }),
  retentionEmailBody({
    eventName: 'Teszt',
    deleteAfterIso: '2027-03-26T10:00:00.000Z',
    timeZone: 'Europe/Budapest',
    eventUrl: 'https://ourfilm.app/e/teszt',
  }),
]

describe.each(documents)('%s', (name, doc) => {
  it('carries the effective date', () => {
    expect(doc.effective).toBe(LEGAL_EFFECTIVE_LABEL)
    expect(documentStrings(doc)).toContain(LEGAL_EFFECTIVE_LABEL)
  })

  it('has a title and a description worth indexing', () => {
    expect(doc.title.length).toBeGreaterThan(3)
    expect(doc.description.length).toBeGreaterThan(30)
  })

  it('has at least one section with a paragraph in it', () => {
    expect(doc.sections.length).toBeGreaterThan(0)
    expect(documentStrings(doc).length).toBeGreaterThan(5)
    expect(name).toBeTruthy()
  })
})

describe('nothing unfinished reaches a reader', () => {
  it('leaves no unresolved template token', () => {
    for (const text of everything) {
      expect(text).not.toMatch(/\{\{|\}\}/)
    }
  })

  it('carries no TODO or bracketed placeholder', () => {
    for (const text of everything) {
      expect(text).not.toMatch(/TODO/)
      // The old `lib/company.ts` convention: `[NÉV — TODO]`, `[ADÓSZÁM — TODO]`.
      expect(text).not.toMatch(/\[[A-ZÁÉÍÓÖŐÚÜŰ ]+ —/)
    }
  })

  it('names no invented company', () => {
    for (const text of everything) {
      expect(text).not.toMatch(/Kft\.|Bt\.|Zrt\.|Cégjegyzékszám/)
    }
  })

  it('does not link the withdrawn EU online dispute resolution platform', () => {
    // The Commission's ODR platform was shut down. A Hungarian ÁSZF that still
    // points a consumer at it is sending them to a dead end at the one moment
    // they need a working remedy.
    for (const text of everything) {
      expect(text.toLowerCase()).not.toContain('ec.europa.eu/odr')
      expect(text.toLowerCase()).not.toContain('odr')
      expect(text).not.toMatch(/online vitarendezési platform/i)
    }
  })
})

describe('no claim the pivot falsified', () => {
  it('never promises unlimited photos or unlimited uploads', () => {
    // The free tier caps *participants*; photos are capped per guest on both
    // plans by the host's chosen roll. Both of these phrases were on /hu/arak
    // and neither has been true since the pivot.
    for (const text of everything) {
      expect(text.toLowerCase()).not.toContain('korlátlan fotó')
      expect(text.toLowerCase()).not.toContain('korlátlan kép')
      expect(text.toLowerCase()).not.toContain('korlátlan feltölt')
    }
  })

  it('never promises the photos are visible immediately', () => {
    // Every reveal is the host's choice. An unconditional "azonnal látható"
    // would contradict the format the whole product is built on.
    for (const text of everything) {
      expect(text).not.toMatch(/azonnal láthatóv?[ak]?\b/i)
    }
  })

  it('offers only the five roll lengths the constraint allows', () => {
    const terms = termsDocument()
    const shotSentence = documentStrings(terms).find((t) =>
      t.startsWith('A támogatott résztvevőnkénti fényképlimitek'),
    )
    expect(shotSentence).toBe(
      'A támogatott résztvevőnkénti fényképlimitek: 5, 10, 16, 24 vagy 36 kép. ' +
        'A kiválasztott limit azt a legnagyobb képszámot jelenti, amelyet ugyanaz ' +
        'a résztvevő az adott eseményhez a szolgáltatás által felismert ' +
        'munkamenetből vagy eszközről elkészíthet. A Házigazda köteles a ' +
        'vendégeket a kiválasztott limitről tájékoztatni. A limit technikai ' +
        'kijátszása tilos.',
    )
  })
})

describe('the sentences the implementation chooses', () => {
  const terms = documentStrings(termsDocument())
  const privacy = documentStrings(privacyDocument())

  it('describes shot consumption the way the capture path works', () => {
    // `reserve_shot` holds a pending row that stops counting after the TTL,
    // and `releaseShotAction` hands it back at once on failure. Only
    // `commit_shot` — after the renders are in Storage — spends the frame.
    expect(SHOT_CONSUMPTION).toBe('after_upload')
    expect(terms).toContain(
      'Egy képkocka akkor számít felhasználtnak, amikor a fénykép sikeresen ' +
        'feltöltődött az OurFilm rendszerébe. A sikertelen vagy a feltöltés ' +
        'előtt megszakított felvétel nem csökkenti a rendelkezésre álló keretet.',
    )
    expect(terms.join(' ')).not.toContain(
      'a fénykép elkészítésekor számít felhasználtnak',
    )
  })

  it('describes the absence of preview and retake', () => {
    expect(RETAKE_SUPPORT).toBe('none')
    expect(terms).toContain(
      'A disposable-camera élmény részeként a vendég a már elkészített képet ' +
        'nem tekintheti meg és nem készítheti el újra a felfedés előtt.',
    )
  })

  it('says the live camera image never leaves the device', () => {
    expect(CAMERA_STREAM).toBe('local_only')
    expect(privacy).toContain(
      'A böngésző kameraengedélyt kér az eszköz kamerájának használatához. Az ' +
        'élő kamerakép az eszközön marad, azt az OurFilm nem továbbítja és nem ' +
        'tárolja. Az OurFilmhez csak a felhasználó által elkészített és ' +
        'feltöltésre véglegesített fénykép kerül.',
    )
  })

  it('says EXIF including location is removed before durable storage', () => {
    expect(IMAGE_METADATA).toBe('stripped')
    expect(privacy).toContain(
      'A feltöltött képekből a rendszer a tartós tárolás előtt eltávolítja az ' +
        'EXIF-metaadatokat, ideértve az esetlegesen rögzített helyadatokat is. ' +
        'Az eltávolítás tényét automatizált teszt ellenőrzi.',
    )
  })

  it('omits the backup paragraph while no backup cycle is verified', () => {
    expect(terms.join(' ')).not.toContain('biztonsági mentésekben legfeljebb')
  })

  it('claims no security measure the repository cannot support', () => {
    // Backups and vulnerability management were removed from the supplied
    // lists rather than restated: nothing here documents either as a process,
    // and a DPA is where an unearned security claim becomes enforceable.
    const annex = documentStrings(processingAnnexDocument()).join(' ')
    expect(annex).not.toContain('mentési és helyreállítási')
    expect(annex).not.toContain('sérülékenységek és frissítések')
    expect(privacy.join(' ')).not.toContain('a mentési folyamatokat')
  })
})

describe('sub-processor table', () => {
  const table = privacyDocument()
    .sections.flatMap((section) => section.blocks)
    .find((block) => block.kind === 'table')

  it('exists and names every provider actually used', () => {
    expect(table).toBeDefined()
    if (table?.kind !== 'table') throw new Error('unreachable')
    expect(table.rows.map((row) => row[0])).toEqual(
      legalConfig.subprocessors.map((sub) => sub.name),
    )
  })

  it('states a safeguard, an in-EEA note, or a visible gap — never a guess', () => {
    if (table?.kind !== 'table') throw new Error('unreachable')
    for (const row of table.rows) {
      expect(row[3].length).toBeGreaterThan(0)
    }
    // Vercel and Resend leave the EEA and nobody has confirmed which
    // safeguard the actual agreement relies on, so the table says so out loud
    // rather than naming the Data Privacy Framework on a hunch.
    const vercel = table.rows.find((row) => row[0].startsWith('Vercel'))
    expect(vercel?.[3]).toBe('HIÁNYZÓ KÖTELEZŐ ADAT')
    for (const row of table.rows) {
      expect(row[3]).not.toContain('Data Privacy Framework')
    }
  })
})

describe('form copy', () => {
  it('uses the exact withdrawal labels', () => {
    expect(WITHDRAWAL_COPY.labels).toEqual({
      name: 'Név',
      order: 'A megrendelés vagy a szerződés azonosítója',
      email: 'A megrendeléshez használt e-mail-cím',
      note: 'Megjegyzés',
    })
    expect(WITHDRAWAL_COPY.submit).toBe('Elállás a szerződéstől')
    expect(WITHDRAWAL_COPY.confirmHeading).toBe('Elállás megerősítése')
    expect(WITHDRAWAL_COPY.confirmSubmit).toBe('Elállás megerősítése')
    expect(WITHDRAWAL_COPY.successHeading).toBe('A nyilatkozatot rögzítettük')
  })

  it('uses the exact report labels', () => {
    expect(REPORT_COPY.labels).toEqual({
      name: 'Neved',
      email: 'E-mail-címed',
      event: 'Az esemény hivatkozása vagy azonosítója',
      content: 'A kifogásolt fénykép vagy tartalom azonosítása',
      reason: 'Miért tartod jogellenesnek vagy jogsértőnek?',
      basis: 'Mely jogodat vagy mely jogszabályt érinti?',
    })
    expect(REPORT_COPY.submit).toBe('Bejelentés elküldése')
  })

  it('confirms a withdrawal without promising a refund', () => {
    const body = withdrawalEmailBody({
      submittedAtIso: '2026-08-26T08:30:00.000Z',
      orderReference: 'ORD-42',
    })
    expect(body).toContain(
      'A nyilatkozat beérkezése önmagában nem jelent automatikus visszatérítést.',
    )
    expect(body).toContain('Megrendelés vagy szerződés azonosítója: ORD-42')
    // The instant, rendered rather than pasted as an ISO string.
    expect(body).toContain('2026. augusztus 26.')
    expect(WITHDRAWAL_EMAIL_SUBJECT).toBe(
      'Elállási vagy felmondási nyilatkozat visszaigazolása – OurFilm',
    )
  })
})

describe('checkout declarations', () => {
  it('states the payment obligation on the button itself', () => {
    expect(CHECKOUT_COPY.paidSubmit).toBe(
      'Fizetési kötelezettséggel járó megrendelés',
    )
  })

  it('keeps the two declarations separate', () => {
    expect(CHECKOUT_COPY.terms).toBe(
      'Elolvastam és elfogadom az Általános Szerződési Feltételeket.',
    )
    expect(CHECKOUT_COPY.earlyPerformance).toContain(
      'Kifejezetten kérem, hogy az OurFilm a 14 napos elállási határidő lejárta előtt kezdje meg a szolgáltatás teljesítését.',
    )
  })

  it('treats the privacy notice as read, never as accepted', () => {
    expect(CHECKOUT_COPY.privacy).toBe(
      'A személyes adatok kezeléséről az Adatkezelési tájékoztatóban olvashatsz.',
    )
    expect(CHECKOUT_COPY.privacy).not.toMatch(/elfogadom|hozzájárul/i)
  })
})

describe('guest acknowledgement', () => {
  it('uses the approved wording', () => {
    expect(GUEST_ACK_COPY.heading).toBe('Mielőtt fotózol')
    expect(GUEST_ACK_COPY.checkbox).toBe(
      'Elolvastam és elfogadom a Vendégfelhasználási feltételeket.',
    )
    expect(GUEST_ACK_COPY.submit).toBe('Folytatás a kamerához')
  })

  it('links the privacy notice rather than asking for consent to it', () => {
    expect(GUEST_ACK_COPY.privacy).toBe(
      'Az adatkezelés részleteit az Adatkezelési tájékoztató tartalmazza.',
    )
    expect(GUEST_ACK_COPY.privacy).not.toMatch(/elfogadom|hozzájárul/i)
  })
})

describe('camera labels', () => {
  it('counts in Hungarian, where a number takes the singular', () => {
    expect(CAMERA_COPY.remaining(1)).toBe('Még 1 képed maradt')
    expect(CAMERA_COPY.remaining(12)).toBe('Még 12 képed maradt')
  })

  it('names the roll length when the roll runs out', () => {
    expect(CAMERA_COPY.emptyHeading).toBe('Elfogytak a képeid')
    expect(CAMERA_COPY.emptyBody(24)).toBe(
      'A Házigazda ehhez az eseményhez 24 képet engedélyezett résztvevőnként.',
    )
  })

  it('states the reveal rule', () => {
    expect(CAMERA_COPY.revealHelper('2026. aug. 29. 23:59')).toBe(
      'A képek ekkor válnak láthatóvá: 2026. aug. 29. 23:59',
    )
  })

  it('says the camera closed without saying anything was deleted', () => {
    expect(CAMERA_COPY.closedHeading).toBe('A fotózás véget ért')
    expect(CAMERA_COPY.closedBody).toBe(
      'Az esemény lezárult, ezért új kép már nem készíthető.',
    )
  })
})

describe('host deletion', () => {
  it('describes deletion as permanent, and asks for the word', () => {
    expect(HOST_DELETE_COPY.heading).toBe('Esemény végleges törlése')
    expect(HOST_DELETE_COPY.confirmLabel).toBe(
      'A megerősítéshez írd be: TÖRLÉS',
    )
    expect(HOST_DELETE_COPY.confirmWord).toBe('TÖRLÉS')
    expect(HOST_DELETE_COPY.submit).toBe('Esemény végleges törlése')
    expect(HOST_DELETE_COPY.body).toContain('A művelet nem vonható vissza.')
  })
})
