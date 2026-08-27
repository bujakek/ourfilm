import { DraftNotice } from '@/components/site/draft-notice'
import {
  LegalSections,
  type LegalSection,
} from '@/components/site/legal-sections'
import { PageShell } from '@/components/site/page-shell'
import {
  COMPANY,
  BILLING_PROVIDER,
  REGISTRY,
  hasRealCompanyDetails,
  EMAIL_PROVIDER,
  LAST_UPDATED,
  PAYMENT_PROCESSOR,
} from '@/lib/company'
import { CONTACT_EMAIL } from '@/lib/site'
import type { Metadata } from 'next'
import { isLocale } from '@/lib/i18n'
import { notFound } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Adatkezelési tájékoztató — OurFilm',
  description:
    'Hogyan kezeli az OurFilm a feltöltött fotókat és a hozzájuk tartozó adatokat.',
  // Indexable as soon as the company details are real; see lib/company.ts.
  ...(hasRealCompanyDetails ? {} : { robots: { index: false, follow: true } }),
}

// Written from a standard GDPR notice structure, with the factual parts
// describing what this system actually does — Zurich storage on the Swiss
// adequacy decision, RLS scoping, no guest cookies, no auto-deletion. The only
// blanks are the company identifiers in lib/company.ts, which nobody but the
// business can supply.
const sections: LegalSection[] = [
  {
    title: 'Ki kezeli az adataidat',
    body: [
      `Szolgáltató: ${COMPANY.name} egyéni vállalkozó, székhely: ${COMPANY.seat}. Nyilvántartási szám: ${COMPANY.registryNumber} (${REGISTRY}). Adószám: ${COMPANY.taxNumber}. Telefonszám: ${COMPANY.phone}.`,
      `E-mail: ${CONTACT_EMAIL}. Adatvédelmi kérdésekben erre a címre írhatsz.`,
      'Az esemény fotói tekintetében az esemény házigazdája az adatkezelő: ő dönti el, hogy az esemény létrejön, kinek adja oda a QR-kódot, és mi maradhat az albumban. Az OurFilm ezekben az adatfeldolgozó, vagyis a házigazda megbízásából tárolja és teszi elérhetővé a képeket. A saját felhasználói fiókod és a látogatottságmérés tekintetében az OurFilm az adatkezelő.',
    ],
  },
  {
    title: 'Milyen adatokat kezelünk',
    body: [
      'A vendégek által feltöltött fényképeket, és a hozzájuk tartozó technikai adatokat: képméret, fájlméret, formátum, és — ha a fotó tartalmazta — a készítés időpontja.',
      'A vendég a csatlakozáskor megadja a nevét. Ezt a saját böngészője tárolja, és minden általa feltöltött fotóhoz hozzákapcsoljuk, hogy látszódjon, kitől érkezett. Bármilyen nevet megadhat; nem ellenőrizzük.',
      'A vendégeknek nincs fiókjuk: nem kérünk e-mail-címet, jelszót és regisztrációt. A házigazda fiókjához e-mail-cím tartozik, mert a belépés e-mailben küldött linkkel történik.',
      'A fotók tartalmát nem elemezzük: nem futtatunk rajtuk arcfelismerést, és nem készítünk belőlük profilt.',
      'Fizetés esetén a bankkártya adatait nem látjuk és nem tároljuk: a fizetés a Stripe saját, általa üzemeltetett oldalán történik. A tranzakció azonosítóit, az összeget, a pénznemet és a fizetés állapotát, továbbá a számla kiállításához megadott nevet, e-mail-címet, postacímet és céges vásárlásnál az adószámot tároljuk.',
    ],
  },
  {
    title: 'Miért kezeljük ezeket, és milyen jogalapon',
    body: [
      'A házigazda fiókja és a szolgáltatás nyújtása: a köztünk létrejött szerződés teljesítése (GDPR 6. cikk (1) b) pont).',
      'Az esemény fotóinak tárolása és megjelenítése: a házigazda megbízásából, az ő adatkezelői jogalapja alapján végezzük (GDPR 28. cikk). A házigazda jogalapja jellemzően az esemény szervezéséhez fűződő jogos érdek.',
      'A szolgáltatás biztonsága, visszaélések megelőzése és a látogatottság mérése: jogos érdekünk (GDPR 6. cikk (1) f) pont).',
      'Számlázási és számviteli kötelezettségek teljesítése: jogi kötelezettség (GDPR 6. cikk (1) c) pont).',
    ],
  },
  {
    title: 'Ki fér hozzá a fotókhoz',
    body: [
      'Az album címe véletlen karaktereket tartalmaz, és nem szerepel egyetlen keresőben sem. Aki nem kapta meg a linket vagy a QR-kódot, nem talál rá.',
      'Az esemény házigazdája látja és letöltheti az album összes fotóját, és el is rejthet közülük bármelyiket.',
      'Munkatársaink csak akkor férnek hozzá, ha ez hibaelhárításhoz szükséges, és titoktartás köti őket.',
      'A fotókat nem adjuk el, nem adjuk át hirdetőknek, és nem használjuk fel marketingcélra a házigazda kifejezett engedélye nélkül.',
      `Adatfeldolgozóink: Supabase (adatbázis és fájltárolás), Vercel (a weboldal kiszolgálása), ${EMAIL_PROVIDER} (a belépési linkek kiküldése), ${PAYMENT_PROCESSOR.name} (fizetés), valamint ${BILLING_PROVIDER.name} (${BILLING_PROVIDER.address}; elektronikus számlázás). Mindegyikkel adatfeldolgozói szerződésünk van.`,
      'A fizetési szolgáltató a saját adatkezelési tájékoztatója szerint önálló adatkezelőként is kezel adatokat — például csalásmegelőzés céljából.',
    ],
  },
  {
    title: 'Hol tároljuk a fotókat',
    body: [
      'A fotók és a hozzájuk tartozó adatok a Supabase zürichi (svájci) régiójában tárolódnak. Svájc az EGT-n kívül van, ezért ez harmadik országba történő adattovábbításnak minősül — az Európai Bizottság megfelelőségi határozata alapján, külön garanciák (SCC) nélkül.',
      'A weboldalt kiszolgáló Vercel Inc. egyesült államokbeli székhelyű. Az ide irányuló adattovábbítás jogalapja az EU–USA adatvédelmi keret (Data Privacy Framework), illetve az Európai Bizottság általános szerződési feltételei.',
      `A fizetéseket a ${PAYMENT_PROCESSOR.name} (${PAYMENT_PROCESSOR.address}) dolgozza fel, amely az Európai Gazdasági Térségen belüli társaság. A Stripe cégcsoporton belüli, EGT-n kívülre irányuló továbbításokra a Stripe saját garanciái (általános szerződési feltételek, illetve az EU–USA adatvédelmi keret) vonatkoznak.`,
    ],
  },
  {
    title: 'Meddig őrizzük meg',
    body: [
      'Az esemény fotóit addig őrizzük, amíg a házigazda törli az eseményt. Nincs automatikus lejárat: nem törlünk magunktól semmit, és nem archiválunk külön másolatot.',
      'Ha a házigazda törli az eseményt, a fotók és a hozzájuk tartozó adatbázissorok véglegesen megszűnnek. A törlés nem visszavonható.',
      'A házigazda fiókját a fiók megszüntetéséig kezeljük. A számlázási adatokat a számviteli törvény szerint 8 évig kötelesek vagyunk megőrizni.',
      'A biztonsági mentésekből a törölt adatok legfeljebb 30 napon belül tűnnek el.',
    ],
  },
  {
    title: 'Ha rólad készült fotó került az albumba',
    body: [
      'A vendégek olyan fotókat is feltölthetnek, amelyeken mások szerepelnek — akik nem jártak az oldalunkon, és nem adtak meg semmit. Rájuk ugyanúgy vonatkoznak az alábbi jogok.',
      'Ha egy rólad készült képet el szeretnél távolíttatni, a leggyorsabb út az esemény házigazdája, aki bármelyik fotót azonnal elrejtheti. Írhatsz nekünk is: ilyenkor felvesszük a kapcsolatot a házigazdával, és a kérést továbbítjuk.',
      'Az eseményen a QR-kártyán is jelezzük, hogy az ott készült képek közös albumba kerülhetnek, és hogy kihez lehet fordulni, ha valaki ezt nem szeretné.',
    ],
  },
  {
    title: 'Milyen jogaid vannak',
    body: [
      'Kérheted a rólad kezelt adatokhoz való hozzáférést, azok helyesbítését, törlését vagy kezelésük korlátozását, tiltakozhatsz az adatkezelés ellen, és kérheted az adatok hordozható formában való kiadását.',
      `A kéréseket a ${CONTACT_EMAIL} címre várjuk. Legkésőbb egy hónapon belül válaszolunk; ha a kérés összetett, ez a határidő két hónappal meghosszabbítható, amiről tájékoztatunk.`,
      'Ha úgy érzed, hogy jogsértés történt, panasszal fordulhatsz a Nemzeti Adatvédelmi és Információszabadság Hatósághoz (NAIH, 1055 Budapest, Falk Miksa utca 9-11., ugyfelszolgalat@naih.hu), vagy bírósághoz, a lakóhelyed szerint illetékes törvényszéken.',
    ],
  },
  {
    title: 'Hogyan védjük az adatokat',
    body: [
      'A kapcsolat titkosított (HTTPS). Az albumok címe véletlen karaktereket tartalmaz, és a keresők elől ki van zárva.',
      'Az adatbázis sorszintű jogosultságkezelést (RLS) használ: a házigazda kizárólag a saját eseményeit éri el, a vendégek pedig egyetlen táblát sem olvashatnak közvetlenül.',
      'Adatvédelmi incidens esetén a tudomásszerzéstől számított 72 órán belül bejelentjük a NAIH-nak, és ha az incidens valószínűsíthetően magas kockázattal jár, az érintetteket is tájékoztatjuk.',
    ],
  },
  {
    title: 'Sütik és mérés',
    body: [
      'A vendégek böngészőjében nem használunk sütiket. A megadott nevet és néhány beállítást a böngésző saját tárhelye (localStorage) őriz — ez nem hagyja el az eszközt, és a böngészőadatok törlésével nyomtalanul eltűnik.',
      'A házigazda belépéséhez sütire van szükség, mert ez tartja fenn a bejelentkezett munkamenetet. Ez működéshez szükséges süti, amelyhez nem kell hozzájárulás.',
      'Látogatottságot mérünk (Vercel Web Analytics), amely oldalletöltéseket számol. A mérés nem használ sütit, és nem alkalmas egyedi látogató azonosítására.',
    ],
  },
  {
    title: 'Gyerekek',
    body: [
      'A szolgáltatást 16 éven aluliak önállóan nem vehetik igénybe: esemény létrehozásához nagykorúság szükséges.',
      'Eseményeken gyerekekről is készülnek fotók. Az ő képeik ugyanúgy kezelendők, mint bárki másé — a szülő vagy törvényes képviselő az esemény házigazdájánál vagy nálunk kérheti bármelyik kép eltávolítását.',
    ],
  },
  {
    title: 'A tájékoztató változásai',
    body: [
      'Ha a tájékoztató lényegesen változik, a módosítás hatálybalépése előtt legalább 15 nappal jelezzük a házigazdáknak e-mailben. A kisebb pontosításokat az alábbi dátum frissítésével jelöljük.',
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
      eyebrow="ADATKEZELÉS"
      title="Adatkezelési tájékoztató"
      lead="Mi történik a feltöltött fotókkal, ki látja őket, és mit tehetsz, ha törölni szeretnél valamit."
    >
      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-3xl">
          {hasRealCompanyDetails ? null : (
            <DraftNotice>
              <strong className="font-semibold text-foreground">
                Hiányoznak a vállalkozás adatai.
              </strong>{' '}
              A szöveg kész, de a szögletes zárójeles helyek ([NÉV],
              [NYILVÁNTARTÁSI SZÁM], [ADÓSZÁM] és társaik) valódi adatra
              cserélendők a <code>lib/company.ts</code> fájlban. Amíg ez nem
              történik meg, az oldal nem jelenik meg a keresőkben.
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
