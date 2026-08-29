import { DraftNotice } from '@/components/site/draft-notice'
import {
  LegalSections,
  type LegalSection,
} from '@/components/site/legal-sections'
import { PageShell } from '@/components/site/page-shell'
import {
  COMPANY,
  REGISTRY,
  hasRealCompanyDetails,
  EMAIL_PROVIDER,
  LAST_UPDATED,
  PAYMENT_PROCESSOR,
} from '@/lib/company'
import { isLocale } from '@/lib/i18n'
import { CONTACT_EMAIL } from '@/lib/site'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Adatkezelési tájékoztató — OurFilm',
  description:
    'Hogyan kezeli az OurFilm az eseményeket, a vendégek adatait és a fényképeket.',
  ...(hasRealCompanyDetails ? {} : { robots: { index: false, follow: true } }),
}

// This notice follows the data flow in the disposable-camera product. In
// particular, the guest's display name is stored in the database and a
// per-event session cookie is set; neither may be described as local-only.
const sections: LegalSection[] = [
  {
    title: 'Ki kezeli az adatokat',
    body: [
      `OurFilm: ${COMPANY.name} egyéni vállalkozó. Székhely: ${COMPANY.seat}. Nyilvántartási szám: ${COMPANY.registryNumber} (${REGISTRY}). Adószám: ${COMPANY.taxNumber}. Telefonszám: ${COMPANY.phone}. E-mail: ${CONTACT_EMAIL}.`,
      'Az OurFilm önálló adatkezelő a házigazda fiókja, az esemény, a szerződés, a kapcsolattartás, a szolgáltatás biztonsága és a saját látogatottságmérése tekintetében. A Stripe és a Link a saját fizetési, adózási, számlázási, csalásmegelőzési, vitakezelési és tranzakciós támogatási céljaik tekintetében önálló adatkezelőként járnak el.',
      'Az esemény és a fotók felhasználásának célját alapvetően a házigazda határozza meg. Amennyiben erre az adatvédelmi szabályok alkalmazandók, az OurFilm a házigazda nevében adatfeldolgozóként tárolja és jeleníti meg az esemény tartalmát. Egy magán- vagy családi esemény házigazdájának adatkezelése egyes esetekben háztartási tevékenységnek minősülhet; ezt mindig a konkrét felhasználás dönti el.',
    ],
  },
  {
    title: 'Milyen adatokat kezelünk',
    body: [
      'Házigazda: e-mail-cím, felhasználói és eseményazonosítók, az esemény neve és beállításai, valamint a belépéshez és a biztonságos munkamenethez szükséges technikai adatok.',
      'Vendég: a csatlakozáskor megadott megjelenített név, egy véletlen munkamenet-azonosító, a megmaradt képkockák száma, valamint az eseményhez és az elkészített képekhez tartozó azonosítók. A vendégtől nem kérünk e-mail-címet és nem hozunk létre számára fiókot.',
      'Fotó: a képfájl, a készítés időpontja, a fájl- és képméret, a formátum és a feldolgozáshoz szükséges technikai állapotok. A kamera képe az eszközön jelenik meg; csak az elkészített és feldolgozott JPEG kerül feltöltésre. A feldolgozás eltávolítja az EXIF-adatokat, így a GPS-helyadat nem kerül a feltöltött fájlba.',
      'Fizetés: az OurFilm a Stripe munkamenet- és tranzakcióazonosítóit, az eseményhez kapcsolást, az összeget, pénznemet, fizetési és visszatérítési állapotot kapja meg. A fizetési mód adatait, a számlázási adatokat és a csalásmegelőzéshez szükséges technikai adatokat a Stripe/Link közvetlenül kezeli; bankkártyaszámot az OurFilm nem kap meg.',
    ],
  },
  {
    title: 'Célok és jogalapok',
    body: [
      'A házigazda fiókját, eseményét és megrendelését a szerződés teljesítéséhez kezeljük (GDPR 6. cikk (1) b)). A saját számviteli, adózási és jogi bizonylatainkat jogi kötelezettség alapján kezeljük (GDPR 6. cikk (1) c)). A vásárlónak szóló tranzakciós számlát vagy bizonylatot a Link állítja ki és őrzi meg a rá vonatkozó szabályok szerint.',
      'A vendég által kért csatlakozást és fotózást a szolgáltatás biztosításához kezeljük. A munkamenet védelme, a képkockakeret érvényesítése, a hibák kivizsgálása és a visszaélések megelőzése az OurFilm és a felhasználók jogos érdeke (GDPR 6. cikk (1) f)).',
      'A képek és a rajtuk szereplő személyek adatkezelésének megfelelő jogalapjáról és az eseményi tájékoztatásról a házigazda gondoskodik, ha az adatvédelmi szabályok az adott eseményre alkalmazandók. Az OurFilm a képeket nem használja saját reklámhoz, arcfelismeréshez vagy profilalkotáshoz.',
      'A sütimentes látogatottságmérés célja a szolgáltatás használatának összesített megértése; ennek jogalapja az OurFilm jogos érdeke. E mérés ellen a böngésző vagy hálózati szűrő beállításaival lehet tiltakozni.',
    ],
  },
  {
    title: 'Ki láthatja a képeket',
    body: [
      'Az eseménylink hosszú, véletlen azonosítót tartalmaz, az oldal nincs keresőbe indexelve, a fájlok pedig nem nyilvános tárhelyen vannak. A linket ugyanakkor bárki továbbadhatja, ezért csak azokkal oszd meg, akiknek hozzáférést szeretnél adni.',
      'A házigazda minden képet elér, letölthet és elrejthet. A vendégek akkor láthatják a felfedett képeket, ha a házigazda ezt engedélyezte. Az OurFilm közreműködője csak üzemeltetés, biztonsági vizsgálat vagy bejelentés kezelése érdekében férhet hozzá, a szükséges mértékben.',
      'Képeket nem értékesítünk, hirdetőknek nem adunk át, és a szolgáltatás nyújtásán túl nem használunk fel.',
    ],
  },
  {
    title: 'Szolgáltatók és adattovábbítás',
    body: [
      `Az adatkezeléshez a következő szolgáltatókat vesszük igénybe: Supabase (adatbázis és privát fájltárolás), Vercel (webalkalmazás és sütimentes látogatottságmérés), ${EMAIL_PROVIDER} (belépési és jogi visszaigazoló e-mailek), valamint fizetésnél ${PAYMENT_PROCESSOR.name} és ${PAYMENT_PROCESSOR.merchantOfRecord}.`,
      `A Link Merchant of Recordként kezeli a fizetést, az alkalmazandó közvetett adót, a vásárlói számlát vagy bizonylatot, a visszatérítést, a fizetési vitát, a csalásmegelőzést és a tranzakciós ügyfélszolgálatot. Ezekhez a célokhoz a vásárlótól közvetlenül is gyűjt adatot. A Link tranzakciós támogatása itt érhető el: ${PAYMENT_PROCESSOR.supportUrl}.`,
      'A Supabase projekt jelenlegi régiója Zürich, Svájc. Svájc az EGT-n kívüli ország, amelyre az Európai Bizottság megfelelőségi határozata vonatkozik.',
      'A Vercel, a Stripe/Link és egyes további szolgáltatók az Egyesült Államokban vagy más EGT-n kívüli országban is kezelhetnek adatot. Ilyen továbbításnál az érintett szolgáltató EU–USA adatvédelmi kerettagságára, európai bizottsági megfelelőségi határozatra vagy általános szerződési feltételekre támaszkodik. A Stripe és a Link saját adatkezelésére a Checkout felületén elérhető adatvédelmi tájékoztatójuk vonatkozik.',
    ],
  },
  {
    title: 'Meddig őrizzük meg az adatokat',
    body: [
      'Az eseményt, a vendégek megjelenített nevét, munkamenetét és a fotókat addig őrizzük, amíg a házigazda törli az eseményt. A pilotban nincs automatikus lejárat. Törlés előtt a házigazdának kell letöltenie a megtartani kívánt képeket.',
      'Az esemény törlésekor az aktív tárhelyen lévő képek és a kapcsolódó eseményadatok véglegesen törlődnek. A szolgáltatói biztonsági mentésekből a másolatok a szolgáltató saját felülírási ciklusa szerint kerülnek ki, és rendes működés során nem használhatók visszaállításra.',
      'A házigazda fiókadatait a fiók megszüntetéséig, a szerződéses igényekhez szükséges adatokat az elévülési idő végéig, a saját számviteli bizonylatainkat pedig a jogszabályban előírt 8 évig őrizzük. A Stripe/Link a saját fizetési és bizonylati adatait a saját tájékoztatója és jogi kötelezettségei szerinti ideig őrzi.',
    ],
  },
  {
    title: 'Sütik és helyi tárhely',
    body: [
      'A vendég csatlakozásakor eseményenként egy feltétlenül szükséges, httpOnly munkamenetsüti kerül a böngészőbe. Ez védi a vendég munkamenetét és érvényesíti a képkockakeretet; legfeljebb egy évig marad meg, vagy korábban törlődik a böngészőadatok törlésekor. Hirdetési sütit nem használunk.',
      'A házigazda bejelentkezéséhez a Supabase Auth feltétlenül szükséges munkamenetsütijei kellenek. Az esemény létrehozása előtt a beállítások egy legfeljebb 7 napig élő piszkozatként a böngésző localStorage tárhelyén maradnak, hogy a belépési kör után folytatható legyen a folyamat.',
      'A Vercel Web Analytics sütik nélkül mér összesített oldalletöltéseket. Amíg nincs nem szükséges süti vagy hasonló követő technológia, külön sütihozzájáruló ablakot nem jelenítünk meg.',
    ],
  },
  {
    title: 'Az érintettek jogai',
    body: [
      'A rád vonatkozó adatkezeléstől függően kérhetsz hozzáférést, helyesbítést, törlést, korlátozást vagy adathordozást, és tiltakozhatsz a jogos érdeken alapuló adatkezelés ellen. E jogok nem korlátlanok; például jogi megőrzési kötelezettség kizárhatja az azonnali törlést.',
      `Kérésedet a ${CONTACT_EMAIL} címre küldheted. A beazonosításhoz kérhetjük az esemény linkjét és a kép pontos megjelölését, de szükségtelen személyes adatot nem kérünk. Főszabály szerint egy hónapon belül válaszolunk.`,
      'A Stripe vagy Link saját célú adatkezelésével kapcsolatos kérelmet közvetlenül náluk is elő kell terjeszteni. Az OurFilm a saját rendszerében tárolt esemény- és fiókadatokra vonatkozó kérelmeket kezeli; a Stripe-fiók vagy a Link tranzakciós adatainak törléséről nem tud egyoldalúan dönteni.',
      'Ha egy rólad készült képet szeretnél elrejteni vagy eltávolíttatni, a leggyorsabb út az esemény házigazdája. Az OurFilmnek a Kapcsolat oldalon található űrlapon vagy e-mailben is jelezheted a kérést.',
      'Panaszt tehetsz a Nemzeti Adatvédelmi és Információszabadság Hatóságnál (NAIH; 1055 Budapest, Falk Miksa utca 9–11.; ugyfelszolgalat@naih.hu), illetve bírósághoz fordulhatsz.',
    ],
  },
  {
    title: 'Biztonság és incidensek',
    body: [
      'A kapcsolat HTTPS-t használ, a képek privát tárhelyre kerülnek, a hozzáférést pedig szerveroldali ellenőrzések és adatbázis-jogosultságok korlátozzák. A nyers vendégmunkamenet-azonosító httpOnly sütiben marad; az adatbázisban ennek csak a lenyomata található.',
      'Adatvédelmi incidens esetén felmérjük a kockázatot, dokumentáljuk az esetet, és ha a GDPR alapján szükséges, a tudomásszerzést követően indokolatlan késedelem nélkül, lehetőség szerint 72 órán belül értesítjük a NAIH-ot. Magas kockázat esetén az érintetteket is tájékoztatjuk.',
    ],
  },
  {
    title: 'Kiskorúak és változások',
    body: [
      'Az esemény létrehozása nagykorú házigazdáknak szól. Eseményeken kiskorúról is készülhet kép; az ilyen képek megosztásánál a házigazdának és a fotó készítőjének különös körültekintéssel kell eljárnia. A szülő vagy törvényes képviselő a házigazdánál vagy nálunk kérheti a kép elrejtését vagy eltávolítását.',
      'A tájékoztató lényeges változását ezen az oldalon, új frissítési dátummal jelezzük. Ha a változás egy meglévő házigazda szerződését vagy jogait érdemben érinti, a rendelkezésünkre álló elérhetőségén is tájékoztatjuk.',
    ],
  },
]

type Props = { params: Promise<{ locale: string }> }

export default async function AdatvedelemPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale) || locale !== 'hu') notFound()

  return (
    <PageShell
      locale={locale}
      eyebrow="ADATKEZELÉS"
      title="Adatkezelési tájékoztató"
      lead="Mit tárolunk az eseményről, a vendégről és a képekről — az új, digitális eldobható fényképezőgép működéséhez igazítva."
    >
      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-3xl">
          {hasRealCompanyDetails ? null : (
            <DraftNotice>
              <strong className="font-semibold text-foreground">
                Indulás előtt töltsd ki az adatkezelő adatait.
              </strong>{' '}
              A <code>lib/company.ts</code> TODO értékei még nem valódi adatok,
              ezért ez az oldal jelenleg nincs indexelve.
            </DraftNotice>
          )}

          <LegalSections sections={sections} />

          <p className="mt-12 text-sm text-muted-foreground">
            Utolsó frissítés: {LAST_UPDATED}
          </p>
        </div>
      </section>
    </PageShell>
  )
}
