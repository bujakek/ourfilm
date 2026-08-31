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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return {
    title: locale === 'en' ? 'Terms of Service — OurFilm' : 'ÁSZF — OurFilm',
    description:
      locale === 'en'
        ? 'Terms governing the use of OurFilm by hosts and guests.'
        : 'Az OurFilm általános szerződési feltételei házigazdák és vendégek számára.',
    ...(hasRealCompanyDetails
      ? {}
      : { robots: { index: false, follow: true } }),
  }
}

// Lean pilot terms. They describe the service that exists today and avoid
// promises which would require a moderation back office, a retention worker or
// a separate enterprise contract process.
const sections: LegalSection[] = [
  {
    title: 'Szolgáltató és kapcsolat',
    body: [
      `Szolgáltató: ${COMPANY.name}. Székhely: ${COMPANY.seat}. Nyilvántartási szám: ${COMPANY.registryNumber}; nyilvántartó: ${REGISTRY}. Adószám: ${COMPANY.taxNumber}.`,
      `E-mail: ${CONTACT_EMAIL}. Tárhelyszolgáltató: ${HOSTING_PROVIDER}.`,
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

const englishSections: LegalSection[] = [
  {
    title: 'Provider and contact',
    body: [
      `OurFilm is provided by ${COMPANY.name}, registered office ${COMPANY.seat}, sole trader registration number ${COMPANY.registryNumber} (${REGISTRY}), tax number ${COMPANY.taxNumber}.`,
      `Email: ${CONTACT_EMAIL}. Hosting provider: ${HOSTING_PROVIDER}.`,
    ],
  },
  {
    title: 'The service',
    body: [
      'OurFilm is a browser-based disposable camera for events. A host creates an event, sets its shooting window, number of shots per guest and reveal time, then shares a QR code or link. Guests can take photos without an app or account. The host can view, hide, download and delete event photos.',
      'A compatible device, internet connection, browser and camera permission are required. We do not promise uninterrupted or error-free availability.',
    ],
  },
  {
    title: 'Contract and eligibility',
    body: [
      `A host enters into a contract with OurFilm by accepting these Terms and creating an event. A paid order becomes final when payment is completed in Stripe Checkout. OurFilm supplies the digital service; ${PAYMENT_PROCESSOR.merchantOfRecord} acts as Merchant of Record for the purchase transaction. The contract is concluded in English for the English flow, is not separately filed, and can be saved or printed from this page.`,
      'Hosts must be at least 18 years old and able to enter into a binding contract. A guest accepts the guest rules and acknowledges the Privacy Notice by joining. Guests are not charged.',
    ],
  },
  {
    title: 'Price and payment',
    body: [
      `Up to 5 distinct guests may join a free event. Unlocking the full event removes this participant cap for that event; it is a one-off purchase, not a subscription or per-guest fee. The final price, currency and applicable taxes are shown in Stripe Checkout before purchase. The Hungarian consumer price is ${EVENT_PRICE_LABEL}.`,
      `${PAYMENT_PROCESSOR.merchantOfRecord} handles the transaction through ${PAYMENT_PROCESSOR.name}. OurFilm does not receive or store card details. Link sends the transaction confirmation and applicable invoice or receipt.`,
    ],
  },
  {
    title: 'Cancellation and refunds',
    body: [
      `Consumers in the EEA generally have 14 days from entering into a paid service contract to withdraw or, after performance begins, terminate without giving a reason. You can send a clear statement to ${CONTACT_EMAIL}. When requesting immediate access, you expressly ask us to begin before that period ends and may owe a proportionate amount for service supplied before cancellation.`,
      'If the paid unlock has not been used before notice is received—meaning no guest beyond the free five-person allowance has joined—we refund the full price. Mandatory consumer remedies and any stronger rights under the law of your country remain unaffected. Refunds are normally made through Stripe/Link to the original payment method within 14 days.',
    ],
  },
  {
    title: 'Acceptable use and content',
    body: [
      'The host must share the event link only with the intended audience and inform attendees about the shared photography. Users may only create or upload content they are entitled to create and share. Illegal, rights-infringing, hateful, severely violent or sexual content, automated abuse and interference with the service are prohibited.',
      'Users retain their rights in photos and grant OurFilm only the non-exclusive permission needed to store, display and make them downloadable as part of the service. We may hide, remove or restrict content or events where required by law, safety or serious or repeated misuse.',
    ],
  },
  {
    title: 'Fair use and availability',
    body: [
      '“Unlimited guests” means that a paid event has no ordinary per-guest product cap. It does not permit bots, scraping, denial-of-service activity, bulk automated uploads or use as general-purpose storage. We may apply proportionate technical limits, temporarily pause uploads, or contact the host where activity threatens security, availability or storage capacity. We will avoid disrupting legitimate event use where reasonably possible.',
      'OurFilm is not a backup service. Hosts should download photos they want to retain. Deleting an event is permanent.',
    ],
  },
  {
    title: 'Liability, complaints and law',
    body: [
      `We remain liable where the law requires, including for defective performance and damage caused by us. We are not responsible for failures outside our reasonable control, user devices or connectivity, or unlawful user content. Complaints may be sent to ${CONTACT_EMAIL}; written complaints are answered in writing within 30 days.`,
      'Hungarian law governs these Terms. This choice does not deprive a consumer of mandatory protections available under the law of their habitual residence. Courts and alternative dispute-resolution bodies remain available as provided by applicable law.',
    ],
  },
  {
    title: 'Changes',
    body: [
      'We publish changes on this page with a new update date. The version accepted at purchase applies to an already paid event unless law or a more favourable change requires otherwise.',
    ],
  },
]

type Props = { params: Promise<{ locale: string }> }

export default async function AszfPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return (
    <PageShell
      locale={locale}
      eyebrow={locale === 'en' ? 'TERMS' : 'ÁSZF'}
      title={
        locale === 'en' ? 'Terms of Service' : 'Általános szerződési feltételek'
      }
      lead={
        locale === 'en'
          ? 'The terms for creating and joining an OurFilm event, including payment, cancellation and fair use.'
          : 'Röviden és a mostani termékhez igazítva: mit nyújt az OurFilm, hogyan fizetsz, és miért felelnek a résztvevők.'
      }
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
