import {
  LEGAL_EFFECTIVE_LABEL,
  legalConfig,
  legalText,
  type LegalConfig,
} from '@/lib/legal/config'
import { p, type LegalDocument } from '@/lib/legal/document'

/**
 * Adatfeldolgozási melléklet — approved source copy, rendered verbatim.
 *
 * Section 3's list of measures is shorter than the supplied draft's. Two items
 * were removed rather than restated: "mentési és helyreállítási eljárásokat"
 * and "sérülékenységek és frissítések kezelését". Nothing in this repository
 * or in a provider agreement available here documents either as a process, and
 * a DPA is precisely the document in which an unearned security claim is
 * enforceable against you. Both are reported as launch blockers; when the
 * procedures exist and are written down, the phrases go back.
 */
export function processingAnnexDocument(
  config: LegalConfig = legalConfig,
): LegalDocument {
  const email = legalText(config.provider.email)

  return {
    title: 'Adatfeldolgozási melléklet',
    description:
      'Az ÁSZF melléklete arra az esetre, amikor az eseményt létrehozó Házigazda adatkezelőnek minősül, az OurFilm pedig a nevében adatfeldolgozást végez.',
    effective: LEGAL_EFFECTIVE_LABEL,
    sections: [
      {
        title: null,
        blocks: [
          p(
            'Ez a melléklet az ÁSZF része, és akkor alkalmazandó, amikor a Házigazda az esemény személyes adatai tekintetében adatkezelőnek minősül, az OurFilm pedig a nevében adatfeldolgozást végez.',
          ),
        ],
      },
      {
        title: '1. A felek és az adatfeldolgozás tárgya',
        blocks: [
          p('Adatkezelő: az OurFilm-eseményt létrehozó Házigazda.'),
          p(
            `Adatfeldolgozó: ${legalText(config.provider.legalName)}, elérhetőség: ${email}.`,
          ),
          p(
            'Az adatfeldolgozás tárgya az OurFilm-esemény működtetéséhez szükséges eseményadatok és felhasználói tartalmak fogadása, tárolása, technikai feldolgozása, felfedése, elérhetővé tétele, letöltésének biztosítása és törlése.',
          ),
          p(
            'Az adatfeldolgozás időtartama a szolgáltatási szerződés és az eseményhez tartozó megőrzési idő fennállása, ideértve a törlés technikai végrehajtásához szükséges időt.',
          ),
          p(
            'Az adatkezelés jellege: automatizált elektronikus tárolás, lekérdezés, technikai átalakítás, továbbítás, hozzáférhetővé tétel, korlátozás és törlés.',
          ),
          p(
            'Az adatkezelés célja: a Házigazda által létrehozott privát digitális esemény és disposable-camera élmény biztosítása.',
          ),
          p(
            'Érintettek: a Házigazda, a vendégek, a fényképeken szereplő személyek és az eseményhez hozzáférő más személyek.',
          ),
          p(
            'Adattípusok: név vagy megjelenített név, fénykép és annak tartalma, eseményhez kapcsolódó azonosítók és beállítások, feltöltési idő, munkamenet- és hozzáférési adatok, valamint a működéshez szükséges technikai metaadatok.',
          ),
        ],
      },
      {
        title: '2. Dokumentált utasítások',
        blocks: [
          p(
            'Az OurFilm a személyes adatokat kizárólag a Házigazda dokumentált utasításai alapján kezeli, ideértve az ÁSZF-ben, az esemény beállításaiban és a szolgáltatás rendeltetésszerű használatával adott utasításokat. Ettől csak akkor tér el, ha azt az OurFilmre alkalmazandó jogszabály előírja; ilyen esetben az OurFilm a Házigazdát előzetesen tájékoztatja, kivéve, ha ezt a jogszabály fontos közérdekből tiltja.',
          ),
          p(
            'Ha az OurFilm megítélése szerint valamely utasítás sérti az adatvédelmi jogszabályokat, erről haladéktalanul tájékoztatja a Házigazdát.',
          ),
        ],
      },
      {
        title: '3. Titoktartás és biztonság',
        blocks: [
          p(
            'Az OurFilm biztosítja, hogy a személyes adatok kezelésére feljogosított személyek titoktartási kötelezettség alatt álljanak vagy megfelelő törvényi titoktartási kötelezettség vonatkozzon rájuk.',
          ),
          p(
            'Az OurFilm a kockázatnak megfelelő technikai és szervezési intézkedéseket alkalmaz, különösen hozzáférés-szabályozást, jogosultságkezelést, titkosított adatátvitelt, naplózást, valamint az al-adatfeldolgozók megfelelő kiválasztását.',
          ),
        ],
      },
      {
        title: '4. Al-adatfeldolgozók',
        blocks: [
          p(
            'A Házigazda általános felhatalmazást ad az OurFilmnek az Adatkezelési tájékoztatóban felsorolt al-adatfeldolgozók igénybevételére. Az OurFilm az új al-adatfeldolgozóról annak igénybevétele előtt, észszerű időben tájékoztatást ad. A Házigazda adatvédelmi szempontból megalapozott kifogást emelhet.',
          ),
          p(
            'Az OurFilm az al-adatfeldolgozóval olyan szerződést köt, amely lényegében azonos adatvédelmi kötelezettségeket ír elő, mint ez a melléklet. Az OurFilm az al-adatfeldolgozó adatvédelmi kötelezettségeinek teljesítéséért a vonatkozó jogszabályok szerint felel.',
          ),
        ],
      },
      {
        title: '5. Érintetti kérelmek és hatósági megkeresések',
        blocks: [
          p(
            'Az OurFilm a kezelés jellegét figyelembe véve megfelelő technikai és szervezési intézkedésekkel segíti a Házigazdát az érintetti jogok gyakorlására irányuló kérelmek teljesítésében. Ha az OurFilm közvetlenül kap ilyen kérelmet az eseménytartalommal kapcsolatban, arról indokolatlan késedelem nélkül tájékoztatja a Házigazdát, kivéve, ha maga is köteles eljárni.',
          ),
          p(
            'Az OurFilm észszerű mértékben segíti a Házigazdát az adatbiztonsági, incidens-bejelentési, hatásvizsgálati és előzetes konzultációs kötelezettségek teljesítésében, figyelembe véve az adatkezelés jellegét és a rendelkezésére álló információkat.',
          ),
        ],
      },
      {
        title: '6. Adatvédelmi incidens',
        blocks: [
          p(
            'Az OurFilm a Házigazda nevében kezelt személyes adatokat érintő adatvédelmi incidensről annak tudomására jutását követően indokolatlan késedelem nélkül értesíti a Házigazdát. Az értesítés a rendelkezésre álló mértékben tartalmazza az incidens jellegét, az érintettek és adatok hozzávetőleges körét, a várható következményeket, valamint a megtett vagy tervezett intézkedéseket. Az információk több részletben is közölhetők, ha egyszerre nem állnak rendelkezésre.',
          ),
        ],
      },
      {
        title: '7. Törlés és visszaszolgáltatás',
        blocks: [
          p(
            'A szolgáltatás megszűnésekor vagy a megőrzési idő lejártakor az OurFilm a Házigazda választása, a szolgáltatás működése és az alkalmazandó jogszabályok szerint törli vagy a rendelkezésére bocsátja a személyes adatokat, majd a megmaradt másolatokat törli, kivéve, ha jogszabály további megőrzést ír elő. A Házigazda a hozzáférési idő alatt maga töltheti le az esemény képeit.',
          ),
        ],
      },
      {
        title: '8. Ellenőrzés',
        blocks: [
          p(
            'Az OurFilm a Házigazda rendelkezésére bocsátja az e melléklet szerinti kötelezettségek igazolásához szükséges információkat, és lehetővé teszi az észszerű, arányos ellenőrzést. Az ellenőrzés nem veszélyeztetheti más ügyfelek adatait, az OurFilm biztonságát vagy üzleti titkait. A felek elsődlegesen dokumentumok, tanúsítványok és távoli egyeztetés útján működnek együtt. Helyszíni ellenőrzésre csak indokolt esetben, előzetes egyeztetéssel kerülhet sor.',
          ),
        ],
      },
      {
        title: '9. Nemzetközi adattovábbítás',
        blocks: [
          p(
            'Az OurFilm az Európai Gazdasági Térségen kívülre csak az alkalmazandó adatvédelmi jogszabályoknak megfelelő garanciák mellett továbbít személyes adatot. Az alkalmazott szolgáltatók és továbbítási garanciák az Adatkezelési tájékoztatóban találhatók.',
          ),
        ],
      },
    ],
  }
}
