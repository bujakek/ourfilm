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
  HOSTING_PROVIDER,
  LAST_UPDATED,
  PAYMENT_PROCESSOR,
} from '@/lib/company'
import { isLocale } from '@/lib/i18n'
import { EVENT_PRICE_LABEL } from '@/lib/pricing'
import { CONTACT_EMAIL } from '@/lib/site'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export const metadata: Metadata = {
  title: 'ÁSZF — OurFilm',
  description:
    'Az OurFilm általános szerződési feltételei házigazdák és vendégek számára.',
  ...(hasRealCompanyDetails ? {} : { robots: { index: false, follow: true } }),
}

// Lean pilot terms. They describe the service that exists today and avoid
// promises which would require a moderation back office, a retention worker or
// a separate enterprise contract process.
const sections: LegalSection[] = [
  {
    title: 'Szolgáltató és kapcsolat',
    body: [
      `Szolgáltató: ${COMPANY.name} egyéni vállalkozó. Székhely: ${COMPANY.seat}. Nyilvántartási szám: ${COMPANY.registryNumber}; nyilvántartó: ${REGISTRY}. Adószám: ${COMPANY.taxNumber}.`,
      `E-mail: ${CONTACT_EMAIL}. Telefonszám: ${COMPANY.phone}. Szakmai kamara: ${COMPANY.chamber}. Tárhelyszolgáltató: ${HOSTING_PROVIDER}.`,
    ],
  },
  {
    title: 'Az OurFilm szolgáltatás',
    body: [
      'Az OurFilm egy eseményhez használható digitális eldobható fényképezőgép. A házigazda létrehozza az eseményt, beállítja a fotózási időszakot, a vendégenkénti képszámot és a képek felfedésének időpontját, majd QR-kódot vagy linket oszt meg a vendégekkel.',
      'A vendég alkalmazás és fiók nélkül, a mobilböngésző kamerájával készít képeket. Nincs előnézet és újrafotózás. A képek a beállított felfedési szabály szerint válnak láthatóvá. A házigazda az esemény képeit megtekintheti, elrejtheti, letöltheti, az eseményt pedig törölheti.',
      'A szolgáltatás használatához megfelelő eszköz, internetkapcsolat, támogatott böngésző és kameraengedély szükséges. Folyamatos, hibamentes elérhetőséget nem garantálunk.',
    ],
  },
  {
    title: 'Szerződéskötés és a használat feltételei',
    body: [
      `A házigazda a feltételek elfogadásával és az esemény létrehozásával köt szerződést az OurFilmmel a digitális szolgáltatás használatára. A fizetős esemény feloldására vonatkozó megrendelés a Stripe fizetési oldalán történő fizetéssel válik véglegessé. Az OurFilm nyújtja a digitális szolgáltatást és felel annak működéséért; a vásárlási tranzakcióban ${PAYMENT_PROCESSOR.merchantOfRecord} jár el Merchant of Recordként. A szerződés magyar nyelven jön létre, nem minősül írásba foglalt szerződésnek, és külön nem iktatjuk.`,
      'A vendég a csatlakozással elfogadja a rá vonatkozó használati szabályokat, és tudomásul veszi az Adatkezelési tájékoztatót. A vendégtől nem kérünk díjat.',
      'A megrendelés előtt a házigazda a böngésző vissza gombjával vagy az OurFilm felületén módosíthatja a megadott adatokat. Az adatbeviteli hibákat a rendszer a létrehozás előtt jelzi.',
    ],
  },
  {
    title: 'Díj és fizetés',
    body: [
      `Az ingyenes eseményhez legfeljebb 5 külön vendég csatlakozhat. A teljes esemény magyarországi fogyasztói végösszege ${EVENT_PRICE_LABEL}; ez az adott eseménynél feloldja a résztvevői korlátot. Nem előfizetés, és nem jelent vendégenkénti díjat. Más ország vagy pénznem esetén a ténylegesen fizetendő, alkalmazandó adót tartalmazó végösszeget a Stripe fizetési oldala mutatja a vásárlás véglegesítése előtt.`,
      `A fizetést ${PAYMENT_PROCESSOR.merchantOfRecord} Merchant of Recordként, a ${PAYMENT_PROCESSOR.name} (${PAYMENT_PROCESSOR.address}) közreműködésével kezeli. A Checkout ezt „${PAYMENT_PROCESSOR.checkoutLabel}” jelöléssel mutatja. A bankkártyaadatokat az OurFilm nem látja és nem tárolja. A Link fizetési feltételei a Stripe Checkout felületén érhetők el.`,
      'A fizetés után a Link közvetlenül küldi meg a vásárlónak a tranzakciós visszaigazolást és az alkalmazandó számlát vagy bizonylatot. A visszatérítésről és az esetleges jóváírásról szóló bizonylatot szintén a Link állítja ki. Az esemény fizetős feloldását a Stripe sikeres fizetési visszaigazolása alapján aktiváljuk.',
    ],
  },
  {
    title: 'Elállás és felmondás fogyasztóként',
    body: [
      `A fogyasztó a fizetős szerződés megkötésétől számított 14 napon belül indokolás nélkül gyakorolhatja elállási vagy — a szolgáltatás megkezdése után — felmondási jogát. Az „Elállás a szerződéstől” funkció a magyar oldal láblécéből közvetlenül, bejelentkezés nélkül elérhető. A nyilatkozat a ${CONTACT_EMAIL} címen is közölhető.`,
      'Az online űrlap kitöltése után az „Elállás megerősítése” gomb küldi el a nyilatkozatot. A beérkezésről haladéktalanul, tartós adathordozón e-mailes elismervényt küldünk, amely tartalmazza a nyilatkozatot, valamint a megküldés dátumát és időpontját.',
      'A fizetéskor a fogyasztó kifejezetten kérheti, hogy a szolgáltatás a 14 napos időszak vége előtt megkezdődjön. Ha a fizetős feloldást a nyilatkozat közléséig nem vették igénybe — vagyis az eseményhez nem csatlakozott az ingyenes 5 fős keretet meghaladó vendég —, a teljes díjat visszatérítjük.',
      'Ha a fizetős szolgáltatás használata már megkezdődött, a nyilatkozat közléséig ténylegesen és arányosan teljesített szolgáltatás díja felszámítható. Ennek megállapításakor az esemény használatának körülményeit vizsgáljuk; önmagában egy meghatározott fotószám elérése vagy a képek letöltése, illetve le nem töltése nem automatikus kizáró feltétel.',
      'A 14 napos időszak után nincs általános, indokolás nélküli visszatérítési jog. Ez nem érinti a hibás teljesítésből vagy kötelező fogyasztóvédelmi szabályból eredő jogokat.',
      `A visszajáró összeget a nyilatkozat közlésétől számított legkésőbb 14 napon belül, az eredeti fizetési móddal, a Stripe/Link rendszerén keresztül térítjük vissza, kivéve, ha a fogyasztó más módhoz kifejezetten hozzájárul. Tranzakciós támogatás és visszatérítési kérelem a Link felületén is indítható: ${PAYMENT_PROCESSOR.supportUrl}. A Link a saját, a kötelező fogyasztói jogokkal összhangban álló szabályai alapján önállóan is jóváhagyhat visszatérítést.`,
    ],
  },
  {
    title: 'Elállási/felmondási nyilatkozatminta',
    body: [
      `Címzett: ${COMPANY.name}, ${COMPANY.seat}, ${CONTACT_EMAIL}. Kijelentem, hogy elállok/felmondom az alábbi szolgáltatás nyújtására irányuló szerződést: [esemény neve, linkje vagy fizetési azonosító]. Szerződéskötés időpontja: [dátum]. Fogyasztó neve: [név]. Fogyasztó címe: [cím]. Kelt: [hely, dátum]. Papíron tett nyilatkozat esetén: [aláírás].`,
      'A minta használata nem kötelező; bármely egyértelmű elállási vagy felmondási nyilatkozat elfogadható.',
    ],
  },
  {
    title: 'A házigazda és a vendég felelőssége',
    body: [
      'A házigazda felel azért, hogy a QR-kódot vagy eseménylinket csak a kívánt körrel ossza meg, és az esemény résztvevőit megfelelően tájékoztassa a közös fotózásról. A link birtokosa továbbadhatja azt, ezért az nem helyettesít külön hozzáférés-kezelést.',
      'Csak olyan képet szabad készíteni vagy feltölteni, amelynek elkészítésére és megosztására a felhasználó jogosult. Tilos a jogellenes, más jogát sértő, gyűlöletkeltő, súlyosan erőszakos vagy szexuális tartalom, valamint a szolgáltatás rendeltetésellenes használata.',
      'A felhasználó a kép szerzői vagy egyéb jogait nem ruházza át. A jogosult az OurFilmnek csak a szolgáltatás működtetéséhez szükséges, nem kizárólagos engedélyt adja a kép tárolására, megjelenítésére és letölthetővé tételére.',
    ],
  },
  {
    title: 'Jogsértő tartalom és korlátozás',
    body: [
      'Jogsértőnek vélt kép vagy eltávolítási kérés a Kapcsolat oldalon található űrlapon vagy e-mailben jelenthető. A kellően pontos bejelentést megvizsgáljuk, és ha jogszabály vagy az érintett joga indokolja, a tartalmat elérhetetlenné tesszük vagy eltávolítjuk. Szükség esetén a megadott elektronikus elérhetőségen kérünk pontosítást vagy adunk tájékoztatást.',
      'A házigazda bármely képet elrejthet. Súlyos vagy ismételt jogsértés, biztonsági kockázat vagy a szolgáltatás működését veszélyeztető használat esetén az érintett tartalmat vagy eseményt korlátozhatjuk.',
    ],
  },
  {
    title: 'Adatok, rendelkezésre állás és felelősség',
    body: [
      'Az OurFilm nem helyettesíti a saját biztonsági mentést. A házigazdának érdemes az esemény után letöltenie a képeket. Az esemény törlése végleges.',
      'A szolgáltató a jogszabályok szerint felel a hibás teljesítésért és az általa okozott károkért. Nem felel az ellenőrzési körén kívüli internet-, eszköz- vagy külső szolgáltatói hibáért, illetve a felhasználó jogellenes tartalmáért. A kötelező fogyasztói jogokat jelen feltételek nem korlátozzák.',
      'A személyes adatok kezelését az Adatkezelési tájékoztató ismerteti.',
    ],
  },
  {
    title: 'Panasz és jogorvoslat',
    body: [
      `Panasz a ${CONTACT_EMAIL} címen, postai úton a székhelyen vagy a fenti telefonszámon tehető. Az írásbeli panaszt 30 napon belül érdemben, írásban megválaszoljuk.`,
      `Fizetéssel, bizonylattal vagy Stripe által kezelt visszatérítéssel kapcsolatos tranzakciós kérdés a Link támogatásánál is jelezhető: ${PAYMENT_PROCESSOR.supportUrl}. A termék működésével és az eseménnyel kapcsolatos panaszért továbbra is az OurFilm felel.`,
      'A fogyasztó a lakóhelye vagy tartózkodási helye szerint illetékes békéltető testülethez fordulhat; az elérhetőségek a bekeltetes.hu oldalon találhatók. A szolgáltató a békéltető testületi eljárásban együttműködik. Fogyasztóvédelmi ügyben a fogyasztóvédelmi hatósághoz, jogvita esetén bírósághoz is lehet fordulni.',
    ],
  },
  {
    title: 'Módosítás és irányadó jog',
    body: [
      'A feltételek módosítását ezen az oldalon, az új frissítési dátummal tesszük közzé. A már kifizetett eseményre a megrendeléskor elfogadott változat irányadó, kivéve, ha jogszabály vagy a felhasználó számára kedvezőbb módosítás másként indokolja.',
      'A jelen ÁSZF-ben nem rendezett kérdésekre a magyar jog, különösen a Polgári Törvénykönyv, a 2001. évi CVIII. törvény és a 45/2014. (II. 26.) Korm. rendelet irányadó.',
    ],
  },
]

type Props = { params: Promise<{ locale: string }> }

export default async function AszfPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale) || locale !== 'hu') notFound()

  return (
    <PageShell
      locale={locale}
      eyebrow="ÁSZF"
      title="Általános szerződési feltételek"
      lead="Röviden és a mostani termékhez igazítva: mit nyújt az OurFilm, hogyan fizetsz, és miért felelnek a résztvevők."
    >
      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-3xl">
          {hasRealCompanyDetails ? null : (
            <DraftNotice>
              <strong className="font-semibold text-foreground">
                Indulás előtt töltsd ki a szolgáltató adatait.
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
