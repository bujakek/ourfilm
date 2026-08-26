import {
  isMissing,
  LEGAL_EFFECTIVE_LABEL,
  legalConfig,
  legalText,
  MISSING_LABEL,
  type LegalConfig,
} from '@/lib/legal/config'
import {
  CAMERA_STREAM,
  CLIENT_STORAGE,
  IMAGE_METADATA,
} from '@/lib/legal/facts'
import {
  p,
  ul,
  type LegalBlock,
  type LegalDocument,
} from '@/lib/legal/document'

/**
 * Adatkezelési tájékoztató — approved source copy, rendered verbatim.
 *
 * Three passages are chosen by what the code does rather than by an author:
 * the camera-preview paragraph, the image-metadata paragraph and the
 * no-advertising-cookies sentence. Each reads a constant from
 * `lib/legal/facts.ts`, where the evidence is written down.
 *
 * The security section deliberately names fewer controls than the supplied
 * draft offered. Backups and vulnerability management were removed — not
 * because they are absent, but because nothing in this repository or in a
 * provider agreement I could read proves them, and an unverified security
 * claim in a privacy notice is exactly the sentence that must not be written.
 * Both are reported as launch blockers.
 */

/** The camera paragraph. The server-assisted branch has no approved copy, so
 *  it must not be papered over with new prose — it is a hard stop. */
function cameraBlocks(): LegalBlock[] {
  if (CAMERA_STREAM === 'local_only') {
    return [
      p(
        'A böngésző kameraengedélyt kér az eszköz kamerájának használatához. Az élő kamerakép az eszközön marad, azt az OurFilm nem továbbítja és nem tárolja. Az OurFilmhez csak a felhasználó által elkészített és feltöltésre véglegesített fénykép kerül.',
      ),
    ]
  }
  // Reaching here means the pipeline started sending live camera or preview
  // data to a server. The approved notice does not cover that, and inventing
  // Hungarian legal prose for it is not this file's job.
  throw new Error(
    'CAMERA_STREAM is server-assisted: the approved privacy notice does not cover server-transmitted camera data. Launch blocker.',
  )
}

/** The image-metadata paragraph. */
function metadataBlocks(): LegalBlock[] {
  return [
    p(
      IMAGE_METADATA === 'stripped'
        ? 'A feltöltött képekből a rendszer a tartós tárolás előtt eltávolítja az EXIF-metaadatokat, ideértve az esetlegesen rögzített helyadatokat is. Az eltávolítás tényét automatizált teszt ellenőrzi.'
        : 'A feltöltött kép technikai metaadatokat, egyes eszközök esetén helyadatot is tartalmazhat. Az OurFilm ezeket a kép részeként kezelheti. Ha nem szeretnél helyadatot megosztani, a fénykép elkészítése előtt kapcsold ki a kamera helyhozzáférését az eszközöd beállításaiban.',
    ),
  ]
}

export function privacyDocument(
  config: LegalConfig = legalConfig,
): LegalDocument {
  const email = legalText(config.provider.email)
  const legalName = legalText(config.provider.legalName)

  const logRetention =
    config.service.securityLogRetentionDays === undefined
      ? MISSING_LABEL
      : String(config.service.securityLogRetentionDays)

  const subprocessorTable: LegalBlock = {
    kind: 'table',
    head: [
      'Szolgáltató',
      'Feladata',
      'Adatkezelés helye',
      'Továbbítási garancia',
    ],
    rows: config.subprocessors.map((sub) => [
      sub.name,
      sub.purpose,
      sub.location,
      sub.transferBasis === undefined
        ? 'Európai Gazdasági Térségen belüli adatkezelés, külön garancia nem szükséges.'
        : isMissing(sub.transferBasis)
          ? MISSING_LABEL
          : sub.transferBasis,
    ]),
  }

  const noAdCookies: LegalBlock[] =
    CLIENT_STORAGE === 'essential_only'
      ? [
          p(
            'Az OurFilm jelenleg nem használ reklámcélú sütiket, és nem végez sütialapú, több weboldalon átívelő követést.',
          ),
        ]
      : []

  return {
    title: 'Adatkezelési tájékoztató',
    description:
      'Milyen adatokat kezel az OurFilm a digitális disposable-camera szolgáltatás során, milyen jogalapon, meddig, és kihez kerülnek.',
    effective: LEGAL_EFFECTIVE_LABEL,
    sections: [
      {
        title: null,
        blocks: [
          p(
            `Ez a tájékoztató bemutatja, hogyan kezeli ${legalName} (székhely: ${legalText(config.provider.registeredSeat)}, e-mail: ${email}; a továbbiakban: „OurFilm”) az OurFilm weboldal és digitális disposable-camera szolgáltatás használata során kezelt személyes adatokat.`,
          ),
        ],
      },
      {
        title: '1. Adatkezelési szerepek',
        blocks: [
          p(
            'Az OurFilm önálló adatkezelőként kezeli a Házigazda fiók-, szerződéses, számlázási, fizetési, ügyfélszolgálati, biztonsági és jogi megfeleléshez szükséges adatait.',
          ),
          p(
            'Az esemény célját, meghívotti körét, beállításait és a fényképekhez hozzáférő személyek körét a Házigazda határozza meg. Az OurFilm az esemény tartalmát technikai szolgáltatóként, a Házigazda utasításai alapján tárolja és teszi elérhetővé. Ha a Házigazda tevékenysége nem kizárólag személyes vagy otthoni célú, és rá az adatvédelmi jogszabályok adatkezelői kötelezettségeket telepítenek, az Adatfeldolgozási melléklet alkalmazandó.',
          ),
          p(
            'Magánjellegű családi vagy baráti eseménynél a Házigazda adatkezelésére alkalmazható lehet a személyes vagy otthoni tevékenységre vonatkozó kivétel. Ez nem érinti az OurFilm saját adatkezeléseire vonatkozó kötelezettségeit.',
          ),
        ],
      },
      {
        title: '2. Milyen adatokat kezelünk?',
        blocks: [
          p('Házigazdai fiók és szerződés'),
          p(
            'Kezelt adatok: név, e-mail-cím, hitelesítési adatok és azonosítók, fiókbeállítások, eseményadatok, az ÁSZF elfogadásának ideje és verziója, megrendelési és kapcsolattartási adatok.',
          ),
          p(
            'Cél: fiók létrehozása, azonosítás, esemény létrehozása és kezelése, a szerződés megkötése és teljesítése, valamint a szerződés igazolása.',
          ),
          p(
            'Jogalap: a szerződés megkötéséhez szükséges lépések és a szerződés teljesítése; az elfogadások igazolása tekintetében az OurFilm jogi igényeinek érvényesítéséhez és megfeleléséhez fűződő jogos érdeke, illetve ahol alkalmazandó, jogi kötelezettség.',
          ),
          p(
            'Megőrzés: a fiók fennállásáig, majd a szerződésből eredő igények elévüléséhez és a kötelező megőrzéshez szükséges ideig.',
          ),

          p('Eseménybeállítások'),
          p(
            'Kezelt adatok: eseménynév, esemény vége, felfedési beállítás, képlimit, hozzáférési azonosítók, QR-kódhoz és meghívóhivatkozáshoz kapcsolódó technikai adatok.',
          ),
          p(
            'Cél: az esemény létrehozása, működtetése, lezárása és a beállított felfedési folyamat teljesítése.',
          ),
          p(
            'Jogalap: a Házigazdával kötött szerződés teljesítése; az eseménytartalom tekintetében a Házigazda dokumentált utasítása.',
          ),
          p(
            `Megőrzés: az esemény végétől számított ${config.service.activeAlbumMonths} hónapos aktív időszak, majd ${config.service.deletionWarningDays} napos türelmi idő; ezt követően törlés, kivéve a jogszabály alapján vagy jogi igényhez szükséges adatokat.`,
          ),

          p('Vendégadatok és fényképek'),
          p(
            'Kezelt adatok: a vendég által megadott név vagy megjelenített név, a vendég munkamenetéhez tartozó technikai azonosító, az elkészített és feltöltött fénykép, a feltöltés ideje, a képlimit állapota, valamint a működéshez és biztonsághoz szükséges technikai adatok.',
          ),
          p(
            'Cél: a vendég csatlakoztatása az eseményhez, a képlimit alkalmazása, a fényképek fogadása, tárolása, felfedése és a jogosult résztvevők számára történő hozzáférhetővé tétele; visszaélés és jogosulatlan hozzáférés megelőzése.',
          ),
          p(
            'Jogalap: az eseménytartalom tekintetében a Házigazda utasítása és az általa meghatározott cél; az OurFilm saját biztonsági naplói tekintetében az OurFilm szolgáltatásbiztonsághoz és visszaélés-megelőzéshez fűződő jogos érdeke.',
          ),
          p(
            `Megőrzés: az esemény végétől számított ${config.service.activeAlbumMonths} hónapos aktív időszak és az azt követő ${config.service.deletionWarningDays} napos türelmi idő, majd törlés; a biztonsági naplókat az alább meghatározott rövidebb vagy indokolt időtartamig őrizzük.`,
          ),

          p('Kamera és helyi előnézet'),
          ...cameraBlocks(),

          p('Képmetaadatok'),
          ...metadataBlocks(),

          p('Technikai és biztonsági adatok'),
          p(
            'Kezelt adatok: IP-cím, időbélyeg, böngésző- és eszköztípus, kérés- és hibainformáció, munkamenet- és biztonsági azonosítók, valamint a jogosulatlan vagy automatizált használat felismeréséhez szükséges naplóadatok.',
          ),
          p(
            'Cél: működtetés, hibakeresés, információbiztonság, csalás- és visszaélés-megelőzés.',
          ),
          p(
            'Jogalap: az OurFilm biztonságos és megbízható működéséhez fűződő jogos érdeke.',
          ),
          p(
            `Megőrzés: a tényleges naplózási beállítások szerinti, a célhoz szükséges legrövidebb idő, legfeljebb ${logRetention} nap, kivéve, ha biztonsági esemény kivizsgálása vagy jogi igény hosszabb megőrzést indokol.`,
          ),

          p('Fizetés és számlázás'),
          p(
            'Kezelt adatok: név, számlázási név és cím, adóazonosító adat, ha szükséges, megrendelés azonosítója, összeg, fizetési állapot, tranzakciós azonosító és számlaadatok. Az OurFilm nem tárol teljes bankkártyaadatot.',
          ),
          p(
            'Cél: fizetés feldolgozása, számla kiállítása, könyvelés és kötelező bizonylatmegőrzés.',
          ),
          p(
            'Jogalap: a szerződés teljesítése és jogi kötelezettség teljesítése.',
          ),
          p('Megőrzés: a számviteli és adójogi szabályok szerinti időtartam.'),

          p('Kapcsolat és ügyfélszolgálat'),
          p(
            'Kezelt adatok: név, e-mail-cím, az üzenet és az ügy megoldásához önként megadott adatok.',
          ),
          p(
            'Cél: kérdések, panaszok, törlési és jogérvényesítési kérelmek kezelése.',
          ),
          p(
            'Jogalap: szerződés teljesítése, jogi kötelezettség, illetve az ügy jellegétől függően az OurFilm igényérvényesítéshez és ügyfélszolgálathoz fűződő jogos érdeke.',
          ),
          p(
            'Megőrzés: az ügy lezárásáig, panasz esetén a jogszabály szerinti ideig, jogi igény esetén az igény érvényesíthetőségéig.',
          ),
        ],
      },
      {
        title: '3. Helyi tárolás és sütik',
        blocks: [
          p(
            'Az OurFilm a regisztráció előtti eseménypiszkozatot a felhasználó eszközének helyi tárhelyén tárolhatja. A helyi piszkozat addig nem kerül az OurFilm szerverére, amíg a felhasználó nem indít szerveroldali mentést vagy eseménylétrehozást. A felhasználó a piszkozatot a felületen vagy a böngésző helyi adatainak törlésével eltávolíthatja.',
          ),
          p(
            'Az OurFilm a bejelentkezéshez, munkamenethez, biztonsághoz és alapvető működéshez szükséges sütiket vagy hasonló technológiákat használhat. Ezek nélkül a szolgáltatás nem működne megfelelően.',
          ),
          ...noAdCookies,
        ],
      },
      {
        title: '4. Adatfeldolgozók és címzettek',
        blocks: [
          p(
            'Az OurFilm csak a szolgáltatás működtetéséhez szükséges körben ad hozzáférést személyes adatokhoz. Az aktuális szolgáltatók:',
          ),
          subprocessorTable,
          p(
            'A táblázat minden soránál megjelenik a szolgáltató neve, feladata, adatkezelési helye és — harmadik országba történő adattovábbítás esetén — az ellenőrzött továbbítási garancia.',
          ),
        ],
      },
      {
        title: '5. Adattovábbítás harmadik országba',
        blocks: [
          p(
            `Ha valamely szolgáltató az Európai Gazdasági Térségen kívül kezel adatot, az OurFilm csak megfelelő jogalap és garanciák mellett veszi igénybe. Ilyen garancia lehet az Európai Bizottság megfelelőségi határozata, jóváhagyott általános szerződési feltételek vagy más, jogszabályban elismert mechanizmus. Az adott szolgáltatóra alkalmazott garanciát az előző táblázat tartalmazza. A garanciákról további tájékoztatás a ${email} címen kérhető.`,
          ),
        ],
      },
      {
        title: '6. Adatbiztonság',
        blocks: [
          p(
            'Az OurFilm a kockázatokhoz igazodó technikai és szervezési intézkedéseket alkalmaz, ideértve a hozzáférések korlátozását, a jogosultságkezelést, a titkosított hálózati kapcsolatot, a naplózást és a szolgáltatók biztonsági beállításainak használatát. Biztonsági intézkedés nem nyújt abszolút védelmet; incidens esetén az OurFilm a vonatkozó jogszabályok szerint jár el, és az érintetteket akkor értesíti, ha annak jogszabályi feltételei fennállnak.',
          ),
        ],
      },
      {
        title: '7. Az érintettek jogai',
        blocks: [
          p('Az alkalmazandó feltételektől függően kérheted:'),
          ul(
            'tájékoztatást személyes adataid kezeléséről és hozzáférést az adataidhoz;',
            'pontatlan adataid helyesbítését;',
            'személyes adataid törlését;',
            'az adatkezelés korlátozását;',
            'az általad rendelkezésünkre bocsátott adatok hordozható formában történő kiadását;',
            'tiltakozhatsz a jogos érdeken alapuló adatkezelés ellen;',
            'hozzájáruláson alapuló adatkezelés esetén a hozzájárulást bármikor visszavonhatod, a visszavonás előtti adatkezelés jogszerűségének érintése nélkül.',
          ),
          p(
            `Kérelmedet a ${email} címre küldheted. Szükség esetén kérhetjük személyazonosságod és az eseménnyel való kapcsolatod észszerű igazolását. A kérelmet indokolatlan késedelem nélkül, főszabály szerint egy hónapon belül megválaszoljuk.`,
          ),
          p(
            'Ha egy esemény fényképével kapcsolatban keresel bennünket, add meg az esemény és a kép azonosításához szükséges információkat. Az OurFilm a kérelmet szükség esetén továbbíthatja a Házigazdának, vagy együttműködhet vele a megfelelő intézkedés érdekében.',
          ),
        ],
      },
      {
        title: '8. Panasz és felügyeleti hatóság',
        blocks: [
          p(
            `Ha úgy gondolod, hogy személyes adataid kezelése jogsértő, kapcsolatba léphetsz velünk a ${email} címen, továbbá panaszt tehetsz a felügyeleti hatóságnál:`,
          ),
          {
            kind: 'definitions',
            items: [
              {
                term: 'Hatóság',
                value: legalText(config.supervisoryAuthority.name),
              },
              {
                term: 'Székhely',
                value: legalText(config.supervisoryAuthority.seat),
              },
              {
                term: 'Levelezési cím',
                value: legalText(config.supervisoryAuthority.mailingAddress),
              },
              {
                term: 'Weboldal',
                value: legalText(config.supervisoryAuthority.website),
              },
              {
                term: 'Telefonszám',
                value: legalText(config.supervisoryAuthority.phone),
              },
            ],
          },
          p('Bírósági jogorvoslatot is igénybe vehetsz.'),
        ],
      },
      {
        title: '9. A tájékoztató módosítása',
        blocks: [
          p(
            'Az OurFilm ezt a tájékoztatót a szolgáltatás vagy a jogszabályi környezet változásakor módosíthatja. A lényeges változásokról a megfelelő felületen vagy e-mailben tájékoztatjuk az érintetteket. A tájékoztató tetején mindig az aktuális hatálybalépési dátum szerepel.',
          ),
        ],
      },
    ],
  }
}
