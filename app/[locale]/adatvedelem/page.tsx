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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return {
    title:
      locale === 'en'
        ? 'Privacy Notice — OurFilm'
        : 'Adatkezelési tájékoztató — OurFilm',
    description:
      locale === 'en'
        ? 'How OurFilm handles account, event, guest and photo data.'
        : 'Hogyan kezeli az OurFilm az eseményeket, a vendégek adatait és a fényképeket.',
    ...(hasRealCompanyDetails
      ? {}
      : { robots: { index: false, follow: true } }),
  }
}

// This notice follows the data flow in the disposable-camera product. In
// particular, the guest's display name is stored in the database and a
// per-event session cookie is set; neither may be described as local-only.
const sections: LegalSection[] = [
  {
    title: 'Ki kezeli az adatokat',
    body: [
      `OurFilm: ${COMPANY.name}. Székhely: ${COMPANY.seat}. Nyilvántartási szám: ${COMPANY.registryNumber} (${REGISTRY}). Adószám: ${COMPANY.taxNumber}. E-mail: ${CONTACT_EMAIL}.`,
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
      'Early Couple Program jelentkezője: név, a pár neve, ha megadják, e-mail-cím, az esküvő dátuma és helyszíne, becsült vendégszámtartomány, a jelentkezés rövid indoka, a választott nyelv, a jelentkezés és a két beszélgetés állapota, valamint az esetleges kampány forrásadatai. A visszaélések korlátozásához a hálózati cím nyers értéke helyett egy elkülönítetten tárolt, nem visszafejthető HMAC-lenyomatot használunk.',
    ],
  },
  {
    title: 'Célok és jogalapok',
    body: [
      'A házigazda fiókját, eseményét és megrendelését a szerződés teljesítéséhez kezeljük (GDPR 6. cikk (1) b)). A saját számviteli, adózási és jogi bizonylatainkat jogi kötelezettség alapján kezeljük (GDPR 6. cikk (1) c)). A vásárlónak szóló tranzakciós számlát vagy bizonylatot a Link állítja ki és őrzi meg a rá vonatkozó szabályok szerint.',
      'A vendég által kért csatlakozást és fotózást a szolgáltatás biztosításához kezeljük. A munkamenet védelme, a képkockakeret érvényesítése, a hibák kivizsgálása és a visszaélések megelőzése az OurFilm és a felhasználók jogos érdeke (GDPR 6. cikk (1) f)).',
      'A képek és a rajtuk szereplő személyek adatkezelésének megfelelő jogalapjáról és az eseményi tájékoztatásról a házigazda gondoskodik, ha az adatvédelmi szabályok az adott eseményre alkalmazandók. Az OurFilm a képeket nem használja saját reklámhoz, arcfelismeréshez vagy profilalkotáshoz.',
      'Az Early Couple Program jelentkezési adatait a jelentkező kérésére történő kapcsolatfelvételhez, a részvétel elbírálásához és elfogadás esetén a program lebonyolításához kezeljük (GDPR 6. cikk (1) b)). A kéretlen automatizált beküldések korlátozása az OurFilm és a jelentkezők jogos érdeke (GDPR 6. cikk (1) f)). A jelentkezés nem jelent hírlevél-feliratkozást, és nyilvános ajánlást sem kérünk érte.',
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
      'Az Early Couple Program jelentkezési adatait a jelentkezés és az esetleges részvétel lezárásáig, főszabályként legfeljebb a jelentkezéstől számított 12 hónapig őrizzük. A technikai visszaélés-megelőzési lenyomatok nem kapcsolódnak a jelentkezési sorhoz, az aktív forgalom során a 30 napnál régebbi értékeket töröljük.',
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

const englishSections: LegalSection[] = [
  {
    title: 'Controller and roles',
    body: [
      `OurFilm is operated by ${COMPANY.name}, registered office ${COMPANY.seat}, registration number ${COMPANY.registryNumber} (${REGISTRY}), tax number ${COMPANY.taxNumber}. Contact: ${CONTACT_EMAIL}.`,
      'OurFilm is controller for host accounts, contracts, service security, support and its own analytics. Stripe and Link are independent controllers for payment, tax, invoicing, fraud prevention and transaction support. Where data-protection law applies to an event, the host normally decides why event photos are used and OurFilm stores and displays that content on the host’s behalf.',
    ],
  },
  {
    title: 'Data we handle',
    body: [
      'For hosts: email address, user and event identifiers, event name and settings, login and session data. For guests: display name, a random session identifier, shot usage and identifiers connecting the guest to the event and photos. Guests do not need an account or email address.',
      'For photos: the processed JPEG, capture time, file and image dimensions, format and processing state. Processing removes EXIF metadata, including GPS location. For payments: Stripe session and transaction identifiers, event association, amount, currency and status; OurFilm never receives card numbers.',
    ],
  },
  {
    title: 'Purposes and legal bases',
    body: [
      'Host accounts, events and orders are processed to perform the contract (GDPR Art. 6(1)(b)); records required by tax, accounting or law are processed under legal obligations (Art. 6(1)(c)). Security, session protection, quota enforcement, troubleshooting, abuse prevention and cookie-free aggregate analytics rely on legitimate interests (Art. 6(1)(f)).',
      'The host is responsible for an appropriate legal basis and event notice for photos and people shown in them where applicable. OurFilm does not use event photos for advertising, facial recognition or profiling.',
    ],
  },
  {
    title: 'Access and sharing',
    body: [
      'Event links contain a long random identifier and photos are stored privately, but anyone can forward a link. The host can access, download and hide every photo. Guests see revealed photos only where the host permits it. Authorised personnel access content only where needed for operations, security or a report.',
      `We use Supabase for database and private file storage, Vercel for hosting and cookie-free analytics, ${EMAIL_PROVIDER} for login and legal emails, and ${PAYMENT_PROCESSOR.name}/${PAYMENT_PROCESSOR.merchantOfRecord} for payment. Providers may process data outside the EEA using an adequacy decision, the EU–US Data Privacy Framework where applicable, or Standard Contractual Clauses.`,
    ],
  },
  {
    title: 'Retention',
    body: [
      'During the pilot, event data, guest display names, sessions and photos remain until the host deletes the event; there is no automatic expiry. Active copies are deleted with the event, while backup copies expire under provider backup cycles and are not ordinarily restored.',
      'Host account data remains until account deletion; claims-related records remain for the applicable limitation period; OurFilm accounting records are retained for eight years where Hungarian law requires it. Stripe/Link retain their own data under their notices and legal obligations.',
    ],
  },
  {
    title: 'Cookies and local storage',
    body: [
      'Joining sets one strictly necessary, event-specific httpOnly session cookie for up to one year. Supabase Auth uses strictly necessary session cookies for hosts. Before account creation, an event draft stays in the browser’s localStorage for up to seven days. We do not use advertising cookies; Vercel Web Analytics measures aggregate page views without cookies.',
    ],
  },
  {
    title: 'Your rights',
    body: [
      `Depending on the processing, you may request access, correction, deletion, restriction or portability, and object to legitimate-interest processing. Send requests to ${CONTACT_EMAIL}; we normally respond within one month and may ask for the event link or exact photo so we can identify the data without collecting unnecessary information.`,
      'For a photo of you, contacting the host is often the fastest route. You may also contact us. You can complain to your local EEA supervisory authority or the Hungarian National Authority for Data Protection and Freedom of Information (NAIH), and seek a judicial remedy. Requests concerning Stripe or Link’s independent processing may also need to be sent directly to them.',
    ],
  },
  {
    title: 'Security, children and changes',
    body: [
      'We use HTTPS, private storage, server-side authorisation and database access controls. Raw guest session identifiers remain in httpOnly cookies and only hashes are stored in the database. We assess and document personal-data incidents and notify authorities or affected people where the GDPR requires it.',
      'Hosts must be adults. Photos may include children; hosts and photographers should take particular care, and a parent or guardian may request that a photo be hidden or removed. Material changes are published here with a new update date and, where appropriate, notified to existing hosts.',
    ],
  },
]

type Props = { params: Promise<{ locale: string }> }

export default async function AdatvedelemPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return (
    <PageShell
      locale={locale}
      eyebrow={locale === 'en' ? 'PRIVACY' : 'ADATKEZELÉS'}
      title={locale === 'en' ? 'Privacy Notice' : 'Adatkezelési tájékoztató'}
      lead={
        locale === 'en'
          ? 'What we store about hosts, events, guests and photos, and why.'
          : 'Mit tárolunk az eseményről, a vendégről és a képekről — az új, digitális eldobható fényképezőgép működéséhez igazítva.'
      }
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

          <LegalSections
            sections={locale === 'en' ? englishSections : sections}
          />

          <p className="mt-12 text-sm text-muted-foreground">
            {locale === 'en' ? 'Last updated' : 'Utolsó frissítés'}:{' '}
            {LAST_UPDATED}
          </p>
        </div>
      </section>
    </PageShell>
  )
}
