import {
  formatHuf,
  LEGAL_EFFECTIVE_LABEL,
  legalConfig,
  legalText,
  type LegalConfig,
} from '@/lib/legal/config'
import { RETAKE_SUPPORT, SHOT_CONSUMPTION } from '@/lib/legal/facts'
import {
  p,
  ul,
  type LegalBlock,
  type LegalDocument,
} from '@/lib/legal/document'

/**
 * Általános Szerződési Feltételek — approved source copy, rendered verbatim.
 *
 * Two sentences in section 2 are chosen by the implementation rather than by
 * an author: which event spends a frame, and whether a guest may check or
 * retake a shot. Both read from `lib/legal/facts.ts`, so changing the capture
 * pipeline without revisiting this file breaks a test instead of quietly
 * publishing a false statement.
 */

/** Section 2's shot-consumption sentence, picked by what the code does. */
function shotSentence(): LegalBlock {
  return p(
    SHOT_CONSUMPTION === 'after_upload'
      ? 'Egy képkocka akkor számít felhasználtnak, amikor a fénykép sikeresen feltöltődött az OurFilm rendszerébe. A sikertelen vagy a feltöltés előtt megszakított felvétel nem csökkenti a rendelkezésre álló keretet.'
      : 'Egy képkocka a fénykép elkészítésekor számít felhasználtnak. A felhasznált képkocka akkor sem állítható vissza automatikusan, ha a vendég a képet később nem tölti fel vagy törli.',
  )
}

/** Section 2's preview/retake sentence, likewise. */
function retakeSentence(): LegalBlock {
  return p(
    RETAKE_SUPPORT === 'none'
      ? 'A disposable-camera élmény részeként a vendég a már elkészített képet nem tekintheti meg és nem készítheti el újra a felfedés előtt.'
      : 'A vendég a felület által biztosított lehetőségek szerint ellenőrizheti vagy újra elkészítheti a felvételt. Csak a véglegesített és sikeresen feltöltött kép kerül az eseményhez.',
  )
}

/** `5, 10, 16, 24 vagy 36` — the list read as Hungarian, from the same array
 *  the check constraint on `events.shots_per_participant` enforces. */
function shotLimitList(config: LegalConfig): string {
  const options = config.service.shotLimitOptions
  return `${options.slice(0, -1).join(', ')} vagy ${options[options.length - 1]}`
}

export function termsDocument(
  config: LegalConfig = legalConfig,
): LegalDocument {
  const email = legalText(config.provider.email)
  const legalName = legalText(config.provider.legalName)
  const price = formatHuf(config.service.priceHuf)

  /**
   * Section 9's backup sentence is conditional on a verified backup cycle.
   * `backupDeletionDays` is undefined until somebody reads the actual Supabase
   * retention window off the dashboard, and an unverified number here would be
   * a promise about data nobody has checked, so the paragraph is simply
   * absent — no claim beats a guessed one.
   */
  const backup: LegalBlock[] =
    config.service.backupDeletionDays === undefined
      ? []
      : [
          p(
            `A törölt adatok elkülönített technikai biztonsági mentésekben legfeljebb ${config.service.backupDeletionDays} napig maradhatnak meg. Ezek a mentések normál használat során nem hozzáférhetők, és a mentési ciklus végén felülíródnak vagy törlődnek.`,
          ),
        ]

  return {
    title: 'Általános Szerződési Feltételek',
    description:
      'Az OurFilm digitális disposable-camera szolgáltatás szerződési feltételei az eseményt létrehozó Házigazda számára.',
    effective: LEGAL_EFFECTIVE_LABEL,
    sections: [
      {
        title: '1. A szolgáltató és az ÁSZF hatálya',
        blocks: [
          p(
            `Az OurFilm szolgáltatást ${legalName} (székhely: ${legalText(config.provider.registeredSeat)}, nyilvántartási szám: ${legalText(config.provider.registrationNumber)}, adószám: ${legalText(config.provider.taxNumber)}, e-mail: ${email}; a továbbiakban: „Szolgáltató”) üzemelteti.`,
          ),
          p(
            'Jelen Általános Szerződési Feltételek az OurFilm weboldalán eseményt létrehozó és a szolgáltatást megrendelő személyre (a továbbiakban: „Házigazda”), valamint a Szolgáltatóra vonatkozó szerződési feltételeket tartalmazzák. A fényképet készítő vagy feltöltő vendégekre külön Vendégfelhasználási feltételek vonatkoznak.',
          ),
          p(
            'A szerződés nyelve magyar. A szerződés elektronikus úton jön létre, nem minősül írásba foglalt szerződésnek, és a Szolgáltató azt külön, egyedileg nem iktatja. A megrendelés és az elfogadott ÁSZF-verzió adatait a Szolgáltató a jogszabályban, illetve az Adatkezelési tájékoztatóban meghatározott ideig megőrzi.',
          ),
        ],
      },
      {
        title: '2. Az OurFilm szolgáltatás',
        blocks: [
          p(
            'Az OurFilm egy böngészőből használható digitális disposable-camera élmény rendezvényekhez. A Házigazda létrehoz egy privát eseményt, amelyhez a vendégek QR-kóddal vagy hivatkozással csatlakozhatnak. A vendégek alkalmazás telepítése és felhasználói fiók létrehozása nélkül készíthetnek fényképeket az eseményhez.',
          ),
          p(
            'Az OurFilm nem biztosít fizikai fényképezőgépet, fényképezőfilmet, fizikai filmelőhívást, nyomtatást vagy papírképek kézbesítését. A „disposable camera”, „eldobható fényképezőgép” és „előhívás” kifejezések a digitális felhasználói élmény megnevezései.',
          ),
          p('A szolgáltatás lényeges elemei:'),
          ul(
            'privát esemény létrehozása és kezelése;',
            'vendégcsatlakozás QR-kóddal vagy hivatkozással;',
            'a Házigazda által kiválasztott, résztvevőnként alkalmazott fényképlimit;',
            'fényképek készítése és feltöltése kompatibilis mobilböngészőből;',
            'a képek Házigazda által kiválasztott időpontban történő felfedése;',
            'a felfedett eseményalbum megtekintése és letöltése a jogosult személyek számára.',
          ),
          p(
            `A támogatott résztvevőnkénti fényképlimitek: ${shotLimitList(config)} kép. A kiválasztott limit azt a legnagyobb képszámot jelenti, amelyet ugyanaz a résztvevő az adott eseményhez a szolgáltatás által felismert munkamenetből vagy eszközről elkészíthet. A Házigazda köteles a vendégeket a kiválasztott limitről tájékoztatni. A limit technikai kijátszása tilos.`,
          ),
          shotSentence(),
          retakeSentence(),
        ],
      },
      {
        title: '3. Az esemény vége és a képek felfedése',
        blocks: [
          p(
            'A Házigazda az esemény létrehozásakor megadja az esemény végét és kiválasztja a felületen elérhető felfedési módok egyikét. A vendégek az esemény lezárásáig készíthetnek képeket, kivéve, ha a Házigazda vagy a Szolgáltató az eseményt korábban lezárja a jelen ÁSZF alapján.',
          ),
          p(
            'A képek a Házigazda által kiválasztott felfedési szabály szerint válnak elérhetővé. A felület a beállítás mentése előtt megjeleníti a kiválasztás eredményét. A Házigazda felelőssége, hogy a vendégekkel egyértelműen közölje, mikor tekinthetik meg a képeket.',
          ),
          p(
            'Az esemény végének és a felfedés időpontjának technikai számítása az alkalmazásban megjelenített dátum és idő alapján történik. A Szolgáltató nem teszi lehetővé az esemény végének visszamenőleges megváltoztatását, ha az a már megkezdett vagy lezárt esemény működését, a vendégek jogos várakozását vagy az adatmegőrzési határidőt kiszámíthatatlanná tenné.',
          ),
        ],
      },
      {
        title: '4. Technikai feltételek és kompatibilitás',
        blocks: [
          p(
            'A szolgáltatás használatához internetkapcsolat, működőképes kamerával rendelkező eszköz, valamint az OurFilm által támogatott, korszerű mobilböngésző szükséges. A felhasználónak engedélyeznie kell a böngésző számára a kamera használatát. A kameraengedély az eszköz technikai engedélye, nem adatvédelmi hozzájárulás.',
          ),
          p(
            'A Szolgáltató nem garantálja, hogy a szolgáltatás minden régi, módosított vagy gyártói támogatással már nem rendelkező eszközön és böngészőben működik. A megrendelés előtt elérhető tájékoztatásban fel kell tüntetni az aktuálisan támogatott böngészőket és a szolgáltatás ismert lényeges korlátait.',
          ),
        ],
      },
      {
        title: '5. Regisztráció, helyi piszkozat és szerződéskötés',
        blocks: [
          p(
            'A Házigazda az esemény egyes beállításait regisztráció előtt, a saját eszközén tárolt helyi piszkozatként megadhatja. A helyi piszkozat létrehozása önmagában nem hoz létre szerződést, nem hoz létre szerveroldali eseményt, és nem jelent fizetési kötelezettséget.',
          ),
          p(
            'A szerződés akkor jön létre, amikor a Házigazda a szükséges adatokat megadja, az ÁSZF-et kifejezetten elfogadja, az esemény létrehozását véglegesíti, és fizetős szolgáltatás esetén a fizetési kötelezettséggel járó megrendelést elküldi. A Szolgáltató a szerződés létrejöttéről és a megrendelés lényeges adatairól elektronikus visszaigazolást küld.',
          ),
          p(
            'A Házigazda köteles valós adatokat megadni, a hozzáférési adatait biztonságosan kezelni, és haladéktalanul jelezni, ha jogosulatlan hozzáférést észlel.',
          ),
        ],
      },
      {
        title: '6. Díj és fizetés',
        blocks: [
          p(
            `A teljes esemény egyszeri díja ${price}. Az ár forintban értendő, a fizetendő végösszeget tartalmazza. A Szolgáltató alanyi adómentes.`,
          ),
          p(
            'A fizetés az alkalmazásban feltüntetett elektronikus fizetési szolgáltatón keresztül történik. A Szolgáltató a teljes bankkártyaadatokat nem kapja meg és nem tárolja. A sikeres fizetésről a Házigazda elektronikus visszaigazolást, valamint a vonatkozó szabályok szerinti számlát kap.',
          ),
          p(
            'A megrendelés elküldése előtt a Házigazda ellenőrizheti és javíthatja a megadott adatokat, megismerheti a szolgáltatás lényeges jellemzőit és a teljes fizetendő összeget.',
          ),
        ],
      },
      {
        title: '7. A szolgáltatás teljesítése és rendelkezésre állása',
        blocks: [
          p(
            'A Szolgáltató a Házigazda kifejezett kérésére a 14 napos elállási határidő lejárta előtt megkezdi a szolgáltatás teljesítését, hogy az esemény a megrendelést követően használható legyen.',
          ),
          p(
            'A szolgáltatás folyamatos internetes és harmadik fél által biztosított infrastruktúrát használ. Rövid idejű karbantartás, biztonsági intézkedés vagy előre nem látható üzemzavar előfordulhat. A Szolgáltató észszerű intézkedéseket tesz a hibák elhárítására és az adatvesztés megelőzésére, de nem ígér megszakítás nélküli vagy minden körülmények között hibamentes működést.',
          ),
          p(
            `Ha a digitális szolgáltatás nem felel meg a szerződésnek, a fogyasztót a mindenkor hatályos jogszabályok szerinti kellékszavatossági és digitális szolgáltatásokra vonatkozó jogok illetik meg. A fogyasztó elsődlegesen kérheti a szolgáltatás szerződésszerűvé tételét. A jogszabályban meghatározott esetekben arányos díjleszállításra vagy a szerződés megszüntetésére is jogosult lehet. E jogok gyakorlásához a Házigazda a ${email} címen léphet kapcsolatba a Szolgáltatóval.`,
          ),
        ],
      },
      {
        title: '8. Elállás és felmondás',
        blocks: [
          p(
            'A fogyasztónak minősülő Házigazdát a távollévők között kötött szerződés esetén a szerződés megkötésétől számított 14 napon belül indokolás nélküli elállási jog illeti meg.',
          ),
          p(
            'Ha a Házigazda kifejezetten kérte a szolgáltatás teljesítésének megkezdését a 14 napos határidő lejárta előtt, majd a teljes teljesítés előtt eláll, köteles megtéríteni a felmondás közléséig arányosan teljesített szolgáltatás ellenértékét. A fogyasztó elállási joga csak a szolgáltatás maradéktalan teljesítését követően szűnik meg, ha a teljesítés előzetes kifejezett beleegyezésével kezdődött, és tudomásul vette, hogy a teljes teljesítéssel elveszíti elállási jogát.',
          ),
          p(
            'Az elállás vagy felmondás a /hu/elallas oldalon elérhető online funkcióval, az ott található nyilatkozatminta felhasználásával vagy más egyértelmű nyilatkozattal gyakorolható. A Szolgáltató az online nyilatkozat beérkezését tartós adathordozón haladéktalanul visszaigazolja.',
          ),
          p(
            'A visszatérítés jogalapját és összegét minden esetben a szerződés állapota, a már igénybe vett szolgáltatás és a vonatkozó jogszabályok alapján kell meghatározni. A rendszer nem adhat automatikusan visszatérítést emberi ellenőrzés nélkül.',
          ),
        ],
      },
      {
        title: '9. Az esemény elérhetősége és törlése',
        blocks: [
          p(
            `Az eseményalbum az esemény végétől számított ${config.service.activeAlbumMonths} hónapig aktívan elérhető. E határidő lejárta előtt a Szolgáltató a Házigazdát a regisztrált e-mail-címén figyelmezteti. A ${config.service.activeAlbumMonths} hónapos időszakot további ${config.service.deletionWarningDays} napos türelmi idő követi, amely alatt a Házigazda még letöltheti a tartalmat. A türelmi idő lejárta után az esemény képei és az eseményhez kapcsolódó, további megőrzési kötelezettség alá nem eső adatok az aktív rendszerekből véglegesen törlésre kerülnek.`,
          ),
          p(
            'A Házigazda az eseményt korábban is törölheti. A törlés előtt a felület egyértelműen figyelmeztet annak következményeire. A Házigazda felelőssége, hogy a megőrizni kívánt képeket a törlés vagy a hozzáférési idő lejárta előtt letöltse.',
          ),
          ...backup,
        ],
      },
      {
        title: '10. Felhasználói tartalom, szerzői jog és képmás',
        blocks: [
          p(
            'A fénykép szerzői joga főszabály szerint a fénykép készítőjét vagy más jogosultat illeti meg. A feltöltés nem ruházza át a szerzői jogot a Szolgáltatóra.',
          ),
          p(
            'A tartalmat feltöltő személy a szolgáltatás működtetéséhez szükséges időre nem kizárólagos, díjmentes, a szolgáltatás technikai teljesítéséhez szükséges területre kiterjedő engedélyt ad a Szolgáltatónak a tartalom tárolására, technikai feldolgozására, átméretezésére, megjelenítésére és a jogosult eseményrésztvevők részére történő hozzáférhetővé tételére. Az engedély a tartalom törlésével megszűnik, a technikai biztonsági mentésekből történő kivezetéshez szükséges korlátozott idő kivételével.',
          ),
          p(
            'A feltöltő engedélyt ad a Házigazdának és az eseményhez jogszerűen hozzáférő résztvevőknek arra, hogy a képet az eseményhez kapcsolódó magáncélra megtekintsék és letöltsék. Ettől eltérő, különösen üzleti, reklám- vagy nyilvános felhasználáshoz külön megfelelő jogalap vagy engedély szükséges.',
          ),
          p(
            'A Házigazda köteles az eseményt és a meghívást úgy megszervezni, hogy a résztvevők megismerhessék a fényképezés és megosztás módját. A feltöltő csak olyan tartalmat tölthet fel, amelynek elkészítésére és szolgáltatáson belüli megosztására jogosult, és amellyel nem sérti más személy szerzői jogát, képmáshoz, magánélethez vagy személyes adatai védelméhez fűződő jogát.',
          ),
        ],
      },
      {
        title: '11. Tiltott tartalom és intézkedések',
        blocks: [
          p(
            'Tilos jogellenes, fenyegető, zaklató, gyűlöletkeltő, erőszakos, szexuálisan kizsákmányoló, kiskorút veszélyeztető, más személy jogát sértő, kártékony kódot tartalmazó vagy a szolgáltatás működését veszélyeztető tartalom feltöltése.',
          ),
          p(
            'A Szolgáltató jogosult a nyilvánvalóan jogellenes vagy a jelen feltételeket sértő tartalmat eltávolítani, hozzáférhetetlenné tenni, az érintett eseményt korlátozni, illetve súlyos vagy ismételt jogsértés esetén a hozzáférést megszüntetni. A Szolgáltató az intézkedés során figyelembe veszi a jogsértés jellegét, súlyát, gyakoriságát és a felhasználók jogait.',
          ),
          p(
            'Jogsértő tartalom a /hu/jogserto-tartalom-bejelentese oldalon jelenthető be.',
          ),
        ],
      },
      {
        title: '12. A Házigazda felelőssége',
        blocks: [
          p(
            'A Házigazda felel az esemény beállításaiért, a hozzáférési link és QR-kód megfelelő címzettekkel történő megosztásáért, a résztvevők tájékoztatásáért, valamint azért, hogy az eseményt jogszerű célra használja. A hozzáférési adatokat nem teheti közzé olyan módon, amely előre láthatóan jogosulatlan hozzáférést okoz.',
          ),
          p(
            'A Házigazda nem használhatja a szolgáltatást titkos megfigyelésre, jogosulatlan adatgyűjtésre vagy olyan rendezvényhez, amelynek jellege a Szolgáltató számára nem közölt, különleges kockázatot jelent.',
          ),
        ],
      },
      {
        title: '13. Felelősségkorlátozás',
        blocks: [
          p(
            'A Szolgáltató a szerződésszegéssel okozott, előrelátható és igazolt károkért a vonatkozó jogszabályok szerint felel. Semmilyen rendelkezés nem korlátozza a szándékosan okozott, az emberi életet, testi épséget vagy egészséget károsító szerződésszegésért fennálló felelősséget, illetve a fogyasztót megillető kötelező jogokat.',
          ),
          p(
            'A Szolgáltató nem felel a felhasználó eszközének hibájából, internetkapcsolatából, megtagadott kameraengedélyéből, támogatottól eltérő böngészőjéből, a Házigazda hibás beállításából vagy jogosulatlanul megosztott eseményhivatkozásból eredő kárért, amennyiben az nem a Szolgáltató mulasztására vezethető vissza.',
          ),
        ],
      },
      {
        title: '14. Módosítás és megszűnés',
        blocks: [
          p(
            'A szerződésre a megrendeléskor elfogadott ÁSZF alkalmazandó. A Szolgáltató a jövőbeli szerződésekre vonatkozó feltételeket módosíthatja. Folyamatosan teljesített, már fennálló szerződést érintő lényeges módosításról a Szolgáltató előzetesen, világosan tájékoztatja a Házigazdát, és biztosítja a jogszabályban előírt jogokat.',
          ),
          p(
            'A szerződés megszűnik a szolgáltatási időszak és a kapcsolódó megőrzési idő lejártával, a felek jogszerű felmondásával, elállással vagy a jelen ÁSZF szerinti megszüntetéssel. A számlázási, jogérvényesítési és biztonsági adatok a szerződés megszűnése után is megőrizhetők a vonatkozó jogszabályok és az Adatkezelési tájékoztató szerint.',
          ),
        ],
      },
      {
        title: '15. Panaszkezelés és jogorvoslat',
        blocks: [
          p(
            `A Házigazda panaszát a ${email} címen vagy a Szolgáltató levelezési címén közölheti. A Szolgáltató az írásbeli panaszt a vonatkozó jogszabály szerinti határidőn belül írásban megválaszolja.`,
          ),
          p(
            `A fogyasztó lakóhelye vagy tartózkodási helye szerint illetékes békéltető testülethez fordulhat. A Szolgáltató székhelye szerint illetékes testület: ${legalText(config.conciliationBody.name)}, cím: ${legalText(config.conciliationBody.seat)}, weboldal: ${legalText(config.conciliationBody.website)}, e-mail: ${legalText(config.conciliationBody.email)}.`,
          ),
          p(
            `Fogyasztóvédelmi ügyben a fogyasztó a lakóhelye szerint illetékes kormányhivatalhoz fordulhat. Tájékoztatás: ${legalText(config.consumerProtectionAuthority.website)}.`,
          ),
        ],
      },
      {
        title: '16. Irányadó jog',
        blocks: [
          p(
            'A szerződésre a magyar jog irányadó. Fogyasztó esetén ez nem fosztja meg a fogyasztót a szokásos tartózkodási helye szerinti állam olyan kötelező védelmi rendelkezéseitől, amelyektől megállapodással nem lehet eltérni.',
          ),
        ],
      },
    ],
  }
}
